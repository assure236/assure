const { ChitGroup, ChitMember, User, Auction, Payment } = require('../models');
const { audit, getIp } = require('../utils/audit');

exports.getAllChitGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    else if (req.user.role === 'member') filter.status = 'active';

    // Exclude groups the member has already joined
    if (req.user.role === 'member') {
      const joinedIds = await ChitMember.distinct('chit_group_id', { user_id: req.user._id || req.user.id });
      if (joinedIds.length > 0) filter._id = { $nin: joinedIds };
    }

    const total = await ChitGroup.countDocuments(filter);
    const groups = await ChitGroup.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Add member_count to each group
    const groupIds = groups.map(g => g._id);
    const memberCounts = await ChitMember.aggregate([
      { $match: { chit_group_id: { $in: groupIds }, is_active: true } },
      { $group: { _id: '$chit_group_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    memberCounts.forEach(mc => { countMap[mc._id.toString()] = mc.count; });
    const groupsWithCounts = groups.map(g => {
      const obj = g.toObject();
      obj.member_count = countMap[g._id.toString()] || 0;
      return obj;
    });

    res.json({ success: true, data: { groups: groupsWithCounts, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getChitGroupById = async (req, res, next) => {
  try {
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });
    const [members, auctions] = await Promise.all([
      ChitMember.find({ chit_group_id: group._id }).populate('user_id', 'full_name mobile'),
      Auction.find({ chit_group_id: group._id }).sort({ created_at: -1 }).limit(5),
    ]);
    // Compute current_month from completed auctions for accurate months tracking
    const completedCount = await Auction.countDocuments({ chit_group_id: group._id, status: 'completed' });
    const groupObj = group.toObject();
    groupObj.current_month = completedCount;
    res.json({ success: true, data: { ...groupObj, members, auctions } });
  } catch (err) { next(err); }
};

exports.getChitGroupMembers = async (req, res, next) => {
  try {
    const members = await ChitMember.find({ chit_group_id: req.params.id })
      .populate('user_id', 'full_name mobile kyc_status');
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};

exports.enrollInChitGroup = async (req, res, next) => {
  try {
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });
    if (group.status !== 'active') return res.status(400).json({ success: false, message: 'Group not open for enrollment' });
    const currentCount = await ChitMember.countDocuments({ chit_group_id: group._id });
    if (currentCount >= group.total_members) return res.status(400).json({ success: false, message: 'Group is full' });
    const userId = req.user._id || req.user.id;
    const existing = await ChitMember.findOne({ chit_group_id: group._id, user_id: userId });
    if (existing) return res.status(400).json({ success: false, message: 'Already enrolled' });
    const member = await ChitMember.create({ chit_group_id: group._id, user_id: userId, ticket_number: currentCount + 1, is_active: true });
    res.status(201).json({ success: true, message: 'Enrolled successfully', data: member });
  } catch (err) { next(err); }
};

exports.getPaymentSchedule = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });
    const payments = await Payment.find({ chit_group_id: group._id, user_id: userId, payment_type: 'installment', payment_status: 'success' }).select('month_number');
    const paidMonths = new Set(payments.map(p => p.month_number));

    // Fetch completed auctions to get dividend info
    const auctions = await Auction.find({ chit_group_id: group._id, status: 'completed', dividend_per_member: { $gt: 0 } })
      .select('month_number dividend_per_member');
    // Build map: month AFTER auction → dividend reduction (one cycle only)
    const dividendMap = {};
    for (const a of auctions) {
      const nextMonth = a.month_number + 1;
      if (nextMonth <= group.duration_months) {
        dividendMap[nextMonth] = (dividendMap[nextMonth] || 0) + a.dividend_per_member;
      }
    }

    const now = new Date();
    const start = group.commencement_date ? new Date(group.commencement_date) : now;
    const schedule = [];
    let firstUnpaidFound = false;
    for (let i = 1; i <= group.duration_months; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      const dividend = dividendMap[i] || 0;
      const baseAmount = group.monthly_installment;
      const amount = Math.max(0, baseAmount - dividend);
      const isPaid = paidMonths.has(i);
      const status = isPaid ? 'paid' : dueDate < now ? 'overdue' : 'pending';
      // Only the first unpaid month is payable (sequential payment order)
      let can_pay = false;
      if (!isPaid && !firstUnpaidFound) {
        can_pay = true;
        firstUnpaidFound = true;
      }
      schedule.push({
        month_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        base_amount: baseAmount,
        dividend_reduction: dividend,
        amount,
        status,
        can_pay,
      });
    }
    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
};

exports.createChitGroup = async (req, res, next) => {
  try {
    // Enforce: total_members = duration_months (chit fund rule)
    if (req.body.duration_months) {
      req.body.total_members = Number(req.body.duration_months);
      if (req.body.chit_value) {
        req.body.monthly_installment = Math.round(Number(req.body.chit_value) / req.body.total_members);
      }
    }
    const group = await ChitGroup.create(req.body);
    res.status(201).json({ success: true, message: 'Chit group created', data: group });
  } catch (err) { next(err); }
};

exports.updateChitGroup = async (req, res, next) => {
  try {
    const group = await ChitGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Chit group updated', data: group });
  } catch (err) { next(err); }
};

exports.deleteChitGroup = async (req, res, next) => {
  try {
    const group = await ChitGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Chit group deleted' });
  } catch (err) { next(err); }
};

exports.activateChitGroup = async (req, res, next) => {
  try {
    const group = await ChitGroup.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Chit group activated', data: group });
  } catch (err) { next(err); }
};

exports.suspendChitGroup = async (req, res, next) => {
  try {
    const group = await ChitGroup.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Chit group suspended', data: group });
  } catch (err) { next(err); }
};

exports.getChitGroupAnalytics = async (req, res, next) => {
  try {
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    const [memberCount, auctionCount, revenueAgg] = await Promise.all([
      ChitMember.countDocuments({ chit_group_id: group._id }),
      Auction.countDocuments({ chit_group_id: group._id, status: 'completed' }),
      Payment.aggregate([{ $match: { chit_group_id: group._id, payment_status: 'success' } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]),
    ]);
    res.json({ success: true, data: { group, memberCount, completedAuctions: auctionCount, totalCollected: revenueAgg[0]?.total || 0, expectedTotal: group.total_members * group.monthly_installment * group.duration_months } });
  } catch (err) { next(err); }
};

// ── Transfer Chit Request ─────────────────────────────────────────────────────
exports.transferChitRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { chit_group_id, recipient_member_id, reason } = req.body;
    if (!chit_group_id || !recipient_member_id) {
      return res.status(400).json({ success: false, message: 'chit_group_id and recipient_member_id are required' });
    }

    const group = await ChitGroup.findById(chit_group_id);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });

    const membership = await ChitMember.findOne({ chit_group_id, user_id: userId, is_active: true });
    if (!membership) return res.status(400).json({ success: false, message: 'You are not an active member of this group' });

    // Check recipient exists
    const recipient = await User.findById(recipient_member_id);
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient user not found' });

    // Check recipient is not already in the group
    const recipientMembership = await ChitMember.findOne({ chit_group_id, user_id: recipient_member_id });
    if (recipientMembership) return res.status(400).json({ success: false, message: 'Recipient is already a member of this group' });

    // Create a notification for admin to process the transfer
    const { Notification } = require('../models');
    await Notification.create({
      user_id: userId,
      type: 'chit_transfer_request',
      title: 'Chit Transfer Request Submitted',
      message: `Your request to transfer chit group "${group.group_name}" to member ${recipient.full_name} has been submitted for admin approval.`,
      metadata: { chit_group_id, recipient_member_id, reason, status: 'pending' },
    });

    // Also notify admins
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
    const adminNotifications = admins.map(admin => ({
      user_id: admin._id,
      type: 'admin_chit_transfer',
      title: 'New Chit Transfer Request',
      message: `${req.user.full_name} requests to transfer ticket #${membership.ticket_number} in "${group.group_name}" to ${recipient.full_name}.`,
      metadata: { chit_group_id, from_user: userId, to_user: recipient_member_id, reason, ticket_number: membership.ticket_number },
    }));
    if (adminNotifications.length > 0) await Notification.insertMany(adminNotifications);

    res.json({ success: true, message: 'Transfer request submitted for admin approval' });

    audit({
      userId, userName: req.user.full_name, userRole: req.user.role,
      action: 'chit_group_transfer_request', resourceType: 'chit_group', resourceId: String(chit_group_id),
      description: `Transfer request for "${group.group_name}" ticket #${membership.ticket_number} to ${recipient.full_name}`,
      metadata: { recipient_id: recipient_member_id, reason, ticket_number: membership.ticket_number },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

// ── Cancel Chit Request ───────────────────────────────────────────────────────
exports.cancelChitRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { chit_group_id, reason } = req.body;
    if (!chit_group_id) {
      return res.status(400).json({ success: false, message: 'chit_group_id is required' });
    }

    const group = await ChitGroup.findById(chit_group_id);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });

    const membership = await ChitMember.findOne({ chit_group_id, user_id: userId, is_active: true });
    if (!membership) return res.status(400).json({ success: false, message: 'You are not an active member of this group' });

    // Cannot cancel if already won an auction
    if (membership.has_won_auction) {
      return res.status(400).json({ success: false, message: 'Cannot cancel — you have already won an auction in this group' });
    }

    const { Notification } = require('../models');
    await Notification.create({
      user_id: userId,
      type: 'chit_cancel_request',
      title: 'Chit Cancellation Request Submitted',
      message: `Your request to cancel membership in "${group.group_name}" has been submitted for admin review.`,
      metadata: { chit_group_id, reason, status: 'pending' },
    });

    // Notify admins
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
    const adminNotifications = admins.map(admin => ({
      user_id: admin._id,
      type: 'admin_chit_cancel',
      title: 'New Chit Cancellation Request',
      message: `${req.user.full_name} requests to cancel membership (ticket #${membership.ticket_number}) in "${group.group_name}".`,
      metadata: { chit_group_id, user_id: userId, reason, ticket_number: membership.ticket_number },
    }));
    if (adminNotifications.length > 0) await Notification.insertMany(adminNotifications);

    res.json({ success: true, message: 'Cancellation request submitted for admin review' });

    audit({
      userId, userName: req.user.full_name, userRole: req.user.role,
      action: 'chit_group_cancel_request', resourceType: 'chit_group', resourceId: String(chit_group_id),
      description: `Cancel request for "${group.group_name}" ticket #${membership.ticket_number}`,
      metadata: { reason, ticket_number: membership.ticket_number },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};
