const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');
const {
  User, ChitGroup, ChitMember, Auction, Bid, Payment,
  Document, Referral, Notification, AppSetting, Branch,
  CommunicationLog, SupportTicket, Wallet, WalletTransaction,
  Account, JournalEntry, FiscalYear, DefaulterAction,
} = require('../models');
const notificationService = require('../services/notificationService');
const { sendPushNotification, sendPushToMultiple } = require('../config/firebase');
const { notifyUser, notifyMultiple } = require('../utils/notifyUser');
const erpnextService = require('../services/erpnextService');
const accountingService = require('../services/accountingService');
const logger = require('../utils/logger');

const adminOnly = [authMiddleware, authorizeRoles('admin', 'manager')];
const superAdminOnly = [authMiddleware, authorizeRoles('super_admin')];

// ─── Admin OTP for sensitive actions ──────────────────────────────────────────
const ADMIN_PHONE = process.env.ADMIN_OTP_PHONE || '6301406134';
const otpStore = new Map(); // key: `${action}_${targetId}` → { otp, expiresAt }

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /admin/otp/send — send OTP to admin phone
router.post('/otp/send', adminOnly, async (req, res) => {
  const { action, target_id } = req.body;
  if (!action || !target_id) return res.status(400).json({ success: false, message: 'action and target_id required' });
  const otp = generateOtp();
  const key = `${action}_${target_id}`;
  otpStore.set(key, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  setTimeout(() => otpStore.delete(key), 5 * 60 * 1000);

  try {
    await notificationService.sendSMS(ADMIN_PHONE, `Assure ChitFunds: Your OTP for ${action} is ${otp}. Valid for 5 minutes.`);
  } catch (e) {
    logger.warn('Admin OTP SMS failed, OTP:', otp);
  }
  logger.info(`Admin OTP generated for ${key}: ${otp}`);
  res.json({ success: true, message: `OTP sent to admin phone ending ***${ADMIN_PHONE.slice(-4)}` });
});

// POST /admin/otp/verify — verify OTP
router.post('/otp/verify', adminOnly, async (req, res) => {
  const { action, target_id, otp } = req.body;
  if (!action || !target_id || !otp) return res.status(400).json({ success: false, message: 'action, target_id, otp required' });
  const key = `${action}_${target_id}`;
  const stored = otpStore.get(key);
  if (!stored) return res.status(400).json({ success: false, message: 'No OTP found. Request a new one.' });
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }
  if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
  otpStore.delete(key);
  res.json({ success: true, message: 'OTP verified successfully' });
});

const toId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch (_) { return null; }
};

// ---------- HELPERS ----------
async function getMonthlyCollections(months) {
  return Promise.all(months.map(async m => {
    const r = await Payment.aggregate([
      { $match: { payment_status: 'success', payment_date: { $gte: m.start, $lte: m.end } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);
    return { month: m.label, amount: r[0]?.total || 0 };
  }));
}

function buildMonths(count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    });
  }
  return months;
}

// ============ DASHBOARD ============
router.get('/dashboard', adminOnly, async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalMembers, activeGroups, totalGroups, completedGroups, pendingKYC, verifiedKYC, rejectedKYC, openTickets, newUsersToday, liveAuctions, totalAuctions
    ] = await Promise.all([
      User.countDocuments({ role: 'member' }),
      ChitGroup.countDocuments({ status: 'active' }),
      ChitGroup.countDocuments({}),
      ChitGroup.countDocuments({ status: 'completed' }),
      User.countDocuments({ kyc_status: 'pending' }),
      User.countDocuments({ kyc_status: 'verified' }),
      User.countDocuments({ kyc_status: 'rejected' }),
      SupportTicket.countDocuments({ status: 'open' }),
      User.countDocuments({ role: 'member', created_at: { $gte: startOfToday } }),
      Auction.countDocuments({ status: 'in_progress' }),
      Auction.countDocuments({}),
    ]);

    const revenueAgg = await Payment.aggregate([
      { $match: { payment_status: 'success', payment_date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);
    const totalRevenueAgg = await Payment.aggregate([
      { $match: { payment_status: 'success' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);
    const overdueAgg = await Payment.aggregate([
      { $match: { payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: now } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total_amount' } } }
    ]);

    const months = buildMonths(6);
    const monthlyCollections = await getMonthlyCollections(months);

    const recentMembers = await User.find({ role: 'member' }).select('full_name mobile kyc_status created_at').sort({ created_at: -1 }).limit(5);
    const recentPayments = await Payment.find({ payment_status: 'success' })
      .populate('user_id', 'full_name mobile')
      .select('total_amount payment_date user_id')
      .sort({ payment_date: -1 }).limit(5);
    const activeAuctionsList = await Auction.find({ status: { $in: ['scheduled', 'in_progress'] } })
      .populate('chit_group_id', 'group_name').sort({ auction_date: 1 }).limit(5);
    const pendingDisbursals = await Auction.find({ status: 'completed', disbursement_status: 'pending' })
      .populate('chit_group_id', 'group_name chit_value').populate('winner_id', 'full_name mobile').limit(5);

    const monthlyRevenue = revenueAgg[0]?.total || 0;
    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const overduePayments = overdueAgg[0]?.count || 0;
    const overdueAmount = overdueAgg[0]?.total || 0;

    // Normalize recent payments to have consistent field names
    const normalizedRecentPayments = recentPayments.map(p => ({
      _id: p._id,
      amount: p.total_amount,
      paid_date: p.payment_date,
      member: p.user_id ? { full_name: p.user_id.full_name, mobile: p.user_id.mobile } : null,
    }));

    res.json({
      success: true,
      data: {
        // camelCase keys (legacy, keep for compat)
        stats: { totalMembers, activeGroups, monthlyRevenue, totalRevenue, pendingKYC, openTickets, activeAuctions: liveAuctions },
        monthlyCollections, recentMembers, activeAuctions: activeAuctionsList, pendingDisbursals,

        // snake_case keys used by admin Dashboard.js
        total_users: totalMembers,
        active_groups: activeGroups,
        total_groups: totalGroups,
        completed_groups: completedGroups,
        monthly_collection: monthlyRevenue,
        total_collection: totalRevenue,
        pending_kyc: pendingKYC,
        verified_kyc: verifiedKYC,
        rejected_kyc: rejectedKYC,
        live_auctions: liveAuctions,
        total_auctions: totalAuctions,
        overdue_payments: overduePayments,
        overdue_amount: overdueAmount,
        new_users_today: newUsersToday,
        open_tickets: openTickets,
        recent_users: recentMembers,
        recent_payments: normalizedRecentPayments,
      }
    });
  } catch (err) { next(err); }
});

// ============ USERS ============
router.get('/users', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, kyc_status, role } = req.query;
    const filter = {};
    if (role) filter.role = role; else filter.role = { $in: ['member', 'agent', 'manager'] };
    if (kyc_status) filter.kyc_status = kyc_status;
    if (search) {
      filter.$or = [
        { full_name: new RegExp(search, 'i') },
        { mobile: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { member_id: new RegExp(search, 'i') },
      ];
    }
    const total = await User.countDocuments(filter);
    const rows = await User.find(filter).select('-password_hash').sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { users: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.get('/users/:id', adminOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const [memberships, documents, payments] = await Promise.all([
      ChitMember.find({ user_id: user._id }).populate('chit_group_id', 'group_name group_number chit_value monthly_installment duration_months commencement_date status'),
      Document.find({ user_id: user._id }).sort({ created_at: -1 }),
      Payment.find({ user_id: user._id }).populate('chit_group_id', 'group_name').sort({ created_at: -1 }).limit(10),
    ]);
    const FamilyMember = require('../models/FamilyMember');
    const familyMembers = await FamilyMember.find({ user_id: user._id, is_active: true }).sort({ created_at: -1 });

    // Build full payment schedule per group
    const groupSchedules = [];
    for (const m of memberships) {
      const group = m.chit_group_id;
      if (!group || !group.duration_months) continue;
      const paidPayments = await Payment.find({ chit_group_id: group._id, user_id: user._id, payment_type: 'installment', payment_status: 'success' }).select('month_number');
      const paidMonths = new Set(paidPayments.map(p => p.month_number));
      const auctions = await Auction.find({ chit_group_id: group._id, status: 'completed', dividend_per_member: { $gt: 0 } }).select('month_number dividend_per_member');
      const dividendMap = {};
      for (const a of auctions) {
        const nextMonth = a.month_number + 1;
        if (nextMonth <= group.duration_months) dividendMap[nextMonth] = (dividendMap[nextMonth] || 0) + a.dividend_per_member;
      }
      const now = new Date();
      const start = group.commencement_date ? new Date(group.commencement_date) : now;
      const schedule = [];
      let paidCount = 0, overdueCount = 0, totalPaid = 0;
      for (let i = 1; i <= group.duration_months; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const dividend = dividendMap[i] || 0;
        const baseAmount = group.monthly_installment;
        const amount = Math.max(0, baseAmount - dividend);
        const isPaid = paidMonths.has(i);
        const status = isPaid ? 'paid' : dueDate < now ? 'overdue' : 'pending';
        if (isPaid) { paidCount++; totalPaid += amount; }
        if (status === 'overdue') overdueCount++;
        schedule.push({ month_number: i, due_date: dueDate.toISOString().split('T')[0], base_amount: baseAmount, dividend_reduction: dividend, amount, status });
      }
      groupSchedules.push({
        group_id: group._id, group_name: group.group_name, group_number: group.group_number,
        chit_value: group.chit_value, status: group.status,
        total_months: group.duration_months, paid_count: paidCount, overdue_count: overdueCount, total_paid: totalPaid,
        schedule
      });
    }

    res.json({ success: true, data: { user, memberships, documents, recentPayments: payments, groupSchedules, familyMembers } });
  } catch (err) { next(err); }
});

router.put('/users/:id', adminOnly, async (req, res, next) => {
  try {
    const { full_name, email, mobile, role, is_active, kyc_status, kyc_rejection_reason, clear_fields,
            pan_number, aadhaar_number, city, state, address, pincode,
            nominee_name, nominee_relation, nominee_phone,
            bank_account_number, bank_ifsc, bank_name } = req.body;
    const update = {};
    const unset = {};
    if (full_name !== undefined) update.full_name = full_name;
    if (email !== undefined) update.email = email;
    if (mobile !== undefined) update.mobile = mobile;
    if (role !== undefined) update.role = role;
    if (is_active !== undefined) update.is_active = is_active;
    if (kyc_status !== undefined) update.kyc_status = kyc_status;
    if (kyc_rejection_reason !== undefined) update.kyc_rejection_reason = kyc_rejection_reason;
    if (kyc_status === 'verified') update.kyc_verified_at = new Date();
    // Editable profile fields
    if (pan_number !== undefined) update.pan_number = pan_number;
    if (aadhaar_number !== undefined) update.aadhaar_number = aadhaar_number;
    if (city !== undefined) update.city = city;
    if (state !== undefined) update.state = state;
    if (address !== undefined) update.address = address;
    if (pincode !== undefined) update.pincode = pincode;
    if (nominee_name !== undefined) update.nominee_name = nominee_name;
    if (nominee_relation !== undefined) update.nominee_relation = nominee_relation;
    if (nominee_phone !== undefined) update.nominee_phone = nominee_phone;
    if (bank_account_number !== undefined) update.bank_account_number = bank_account_number;
    if (bank_ifsc !== undefined) update.bank_ifsc = bank_ifsc;
    if (bank_name !== undefined) update.bank_name = bank_name;
    // Allow admin to clear specific fields (e.g. pan_number, aadhaar_number, email)
    if (Array.isArray(clear_fields)) {
      const allowed = ['pan_number', 'aadhaar_number', 'email', 'address', 'city', 'state', 'pincode', 'nominee_name', 'nominee_relation', 'nominee_phone', 'bank_account_number', 'bank_ifsc', 'bank_name'];
      for (const f of clear_fields) {
        if (allowed.includes(f)) unset[f] = 1;
      }
    }
    const ops = { $set: update };
    if (Object.keys(unset).length > 0) ops.$unset = unset;
    const user = await User.findByIdAndUpdate(req.params.id, ops, { new: true }).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Notify user of KYC status change (push + in-app only, no SMS)
    if (kyc_status === 'verified') {
      notifyUser(user._id, 'KYC Approved ✅', 'Your KYC verification is approved. You can now participate in auctions.', 'kyc_update').catch(() => {});
    }
    if (kyc_status === 'rejected') {
      notifyUser(user._id, 'KYC Rejected ❌', 'Your KYC was rejected: ' + (kyc_rejection_reason || 'Contact support'), 'kyc_update').catch(() => {});
    }
    res.json({ success: true, message: 'User updated', data: user });
  } catch (err) { next(err); }
});

router.post('/users/:id/toggle-status', adminOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.is_active = !user.is_active;
    await user.save();
    notifyUser(user._id, user.is_active ? 'Account Activated ✅' : 'Account Deactivated ⚠️', user.is_active ? 'Your account has been activated. You can now use all features.' : 'Your account has been deactivated. Contact support for help.', 'account_update').catch(() => {});
    res.json({ success: true, message: 'User status toggled', data: { is_active: user.is_active } });
  } catch (err) { next(err); }
});

// ============ KYC ============
router.get('/kyc/pending', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total = await User.countDocuments({ kyc_status: 'pending' });
    const users = await User.find({ kyc_status: 'pending' }).select('-password_hash').sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    const withDocs = await Promise.all(users.map(async u => {
      const docs = await Document.find({ user_id: u._id }).sort({ created_at: -1 });
      return { ...u.toObject(), documents: docs };
    }));
    res.json({ success: true, data: { users: withDocs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/kyc/:userId/approve', adminOnly, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { kyc_status: 'verified', kyc_verified_at: new Date() }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await Document.updateMany({ user_id: user._id, verification_status: 'pending' }, { verification_status: 'verified', verified_at: new Date(), verified_by: req.user._id || req.user.id });
    notifyUser(user._id, 'KYC Approved ✅', 'Your KYC verification is approved. You can now participate in auctions.', 'kyc_update').catch(() => {});
    res.json({ success: true, message: 'KYC approved' });
  } catch (err) { next(err); }
});

router.post('/kyc/:userId/reject', adminOnly, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { kyc_status: 'rejected', kyc_rejection_reason: reason || 'Documents insufficient' }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await Document.updateMany({ user_id: user._id, verification_status: 'pending' }, { verification_status: 'rejected', rejected_reason: reason });
    notifyUser(user._id, 'KYC Rejected ❌', 'Your KYC was rejected: ' + (reason || 'Contact support. Please re-upload documents.'), 'kyc_update').catch(() => {});
    res.json({ success: true, message: 'KYC rejected' });
  } catch (err) { next(err); }
});

// ============ CHIT GROUPS ============
router.get('/chit-groups', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [{ group_name: new RegExp(search, 'i') }, { group_number: new RegExp(search, 'i') }];
    const total = await ChitGroup.countDocuments(filter);
    const groups = await ChitGroup.find(filter).sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    const withCounts = await Promise.all(groups.map(async g => {
      const [memberCount, paymentAgg] = await Promise.all([
        ChitMember.countDocuments({ chit_group_id: g._id }),
        Payment.aggregate([{ $match: { chit_group_id: g._id, payment_status: 'success' } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }])
      ]);
      return { ...g.toObject(), memberCount, totalCollected: paymentAgg[0]?.total || 0 };
    }));
    res.json({ success: true, data: { chit_groups: withCounts, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.get('/chit-groups/:id', adminOnly, async (req, res, next) => {
  try {
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    const [members, auctions, payments] = await Promise.all([
      ChitMember.find({ chit_group_id: group._id }).populate('user_id', 'full_name mobile kyc_status'),
      Auction.find({ chit_group_id: group._id }).sort({ auction_date: -1 }),
      Payment.find({ chit_group_id: group._id }).populate('user_id', 'full_name mobile').sort({ created_at: -1 }).limit(20),
    ]);
    const revenueAgg = await Payment.aggregate([
      { $match: { chit_group_id: group._id, payment_status: 'success' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);
    res.json({ success: true, data: { group, members, auctions, recentPayments: payments, totalCollected: revenueAgg[0]?.total || 0 } });
  } catch (err) { next(err); }
});

router.post('/chit-groups', adminOnly, async (req, res, next) => {
  try {
    // Use provided group_number or auto-generate
    if (!req.body.group_number) {
      const count = await ChitGroup.countDocuments();
      req.body.group_number = `GRP-${String(count + 1).padStart(6, '0')}`;
    }
    const group = await ChitGroup.create(req.body);
    res.status(201).json({ success: true, message: 'Chit group created', data: group });
  } catch (err) { next(err); }
});

router.put('/chit-groups/:id', adminOnly, async (req, res, next) => {
  try {
    const group = await ChitGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Chit group updated', data: group });
  } catch (err) { next(err); }
});

router.post('/chit-groups/:id/add-member', adminOnly, async (req, res, next) => {
  try {
    const { user_id } = req.body;
    const group = await ChitGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const existing = await ChitMember.findOne({ chit_group_id: group._id, user_id });
    if (existing) return res.status(400).json({ success: false, message: 'Already a member' });
    const currentCount = await ChitMember.countDocuments({ chit_group_id: group._id });
    if (currentCount >= group.total_members) return res.status(400).json({ success: false, message: 'Group is full' });
    const member = await ChitMember.create({ chit_group_id: group._id, user_id, ticket_number: currentCount + 1, is_active: true });
    notifyUser(user_id, 'Added to Chit Group 🎉', `You have been added to ${group.group_name}. Welcome!`, 'general', { group_id: String(group._id) }).catch(() => {});
    res.status(201).json({ success: true, message: 'Member added', data: member });
  } catch (err) { next(err); }
});

// ============ AUCTIONS ============
router.get('/auctions', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, chit_group_id } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (chit_group_id) filter.chit_group_id = chit_group_id;
    const total = await Auction.countDocuments(filter);
    const auctions = await Auction.find(filter)
      .populate('chit_group_id', 'group_name group_number chit_value')
      .populate('winner_id', 'full_name mobile')
      .sort({ auction_date: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { auctions, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.get('/auctions/:id', adminOnly, async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('chit_group_id').populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    const bids = await Bid.find({ auction_id: auction._id }).populate('user_id', 'full_name mobile').sort({ bid_amount: -1 });
    
    const auctionData = auction.toObject();
    const timerManager = req.app.get('timerManager');
    
    // Add server_time_remaining for active/paused auctions
    if (timerManager && timerManager.isActive(auction._id)) {
      auctionData.server_time_remaining = timerManager.getTimeRemaining(auction._id);
      auctionData.server_end_time = timerManager.getEndTime(auction._id)?.toISOString();
    } else if ((auction.status === 'in_progress' || auction.status === 'active' || auction.status === 'paused') && auction.end_time) {
      const remaining = Math.max(0, Math.floor((new Date(auction.end_time) - Date.now()) / 1000));
      auctionData.server_time_remaining = remaining;
      auctionData.server_end_time = auction.end_time;
    }
    
    res.json({ success: true, data: { auction: auctionData, bids } });
  } catch (err) { next(err); }
});

router.post('/auctions', adminOnly, async (req, res, next) => {
  try {
    // auction_date is required by model — derive it from start_time if not provided
    const body = { ...req.body };
    if (!body.auction_date && body.start_time) body.auction_date = body.start_time;
    const auction = await Auction.create(body);
    const populated = await Auction.findById(auction._id).populate('chit_group_id', 'group_name group_number chit_value');
    const io = req.app.get('io');
    if (io) {
      io.emit('auction_created', { auction: populated });
    }
    res.status(201).json({ success: true, message: 'Auction scheduled', data: populated });
  } catch (err) { next(err); }
});

router.put('/auctions/:id', adminOnly, async (req, res, next) => {
  try {
    const auction = await Auction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Auction updated', data: auction });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/start', adminOnly, async (req, res, next) => {
  try {
    const timerManager = require('../services/auctionTimerManager');
    const auction = await Auction.findById(req.params.id).populate('chit_group_id', 'group_name chit_value');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Auction is not in scheduled status' });

    const now = new Date();
    const durationMs = (auction.duration_minutes || 30) * 60 * 1000;
    const endTime = auction.end_time || new Date(now.getTime() + durationMs);

    await Auction.findByIdAndUpdate(auction._id, {
      status: 'in_progress',
      actual_start_time: now,
      scheduled_end_time: endTime,
      end_time: endTime,
    });

    // Start server-controlled timer
    timerManager.startTimer(
      auction._id,
      endTime,
      auction.anti_snipe_seconds || 15,
      auction.anti_snipe_extension || 30,
    );

    const io = req.app.get('io');
    if (io) {
      const payload = {
        auction_id: String(auction._id),
        group_name: auction.chit_group_id?.group_name,
        chit_value: auction.chit_group_id?.chit_value,
        status: 'active',
        server_end_time: endTime.toISOString(),
        duration_minutes: auction.duration_minutes || 30,
        min_bid_increment: auction.min_bid_increment || 100,
        bid_fee: auction.bid_fee || 0,
        anti_snipe_seconds: auction.anti_snipe_seconds || 15,
      };
      io.to('auction:' + auction._id).emit('auction_started', payload);
      io.emit('auction_status_changed', payload);
    }
    const updated = await Auction.findById(auction._id).populate('chit_group_id', 'group_name');
    // Notify all group members about auction start
    const groupMembers = await ChitMember.find({ chit_group_id: auction.chit_group_id?._id }).select('user_id');
    const memberIds = groupMembers.map(m => m.user_id.toString());
    notifyMultiple(memberIds, 'Auction Started 🔨', `Auction for ${auction.chit_group_id?.group_name || 'your chit group'} has started! Place your bids now.`, 'auction_alert', { auction_id: String(auction._id) }).catch(() => {});
    res.json({ success: true, message: 'Auction started with server timer', data: { ...updated.toObject(), server_end_time: endTime.toISOString() } });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/cancel', adminOnly, async (req, res, next) => {
  try {
    const { cancelAuction } = require('../controllers/auctionController');
    // Delegate to controller
    req.params.id = req.params.id;
    await cancelAuction(req, res, next);
  } catch (err) { next(err); }
});

router.post('/auctions/:id/end', adminOnly, async (req, res, next) => {
  try {
    const timerManager = require('../services/auctionTimerManager');
    const { endAuctionById } = require('../controllers/auctionController');
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });

    await endAuctionById(auction._id, req.app.get('io'));

    const updated = await Auction.findById(auction._id).populate('winner_id', 'full_name mobile');
    if (updated.winner_id) notifyUser(updated.winner_id._id, 'Auction Won! 🎉', `Congratulations! You won the auction with bid ₹${updated.winning_bid_amount}. Disbursement in 2-3 business days.`, 'auction_result', { auction_id: String(auction._id) }).catch(() => {});
    res.json({ success: true, message: 'Auction ended', data: updated });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/pause', adminOnly, async (req, res, next) => {
  try {
    const timerManager = require('../services/auctionTimerManager');
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Auction is not in progress' });

    const remaining = timerManager.getTimeRemaining(auction._id);
    timerManager.stopTimer(auction._id);

    await Auction.findByIdAndUpdate(auction._id, { status: 'paused', paused_time_remaining: remaining });

    const io = req.app.get('io');
    if (io) {
      io.to('auction:' + auction._id).emit('auction_paused', { auction_id: String(auction._id), remaining_seconds: remaining });
      io.emit('auction_status_changed', { auction_id: String(auction._id), status: 'paused' });
    }

    const updated = await Auction.findById(req.params.id).populate('chit_group_id', 'group_name');
    res.json({ success: true, message: 'Auction paused', data: updated });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/resume', adminOnly, async (req, res, next) => {
  try {
    const timerManager = require('../services/auctionTimerManager');
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'paused') return res.status(400).json({ success: false, message: 'Auction is not paused' });

    const remaining = auction.paused_time_remaining || 60;
    const newEndTime = new Date(Date.now() + remaining * 1000);

    timerManager.startTimer(auction._id, newEndTime, auction.anti_snipe_seconds || 15, auction.anti_snipe_extension || 30);

    await Auction.findByIdAndUpdate(auction._id, { status: 'in_progress', end_time: newEndTime, scheduled_end_time: newEndTime, paused_time_remaining: 0 });

    const io = req.app.get('io');
    if (io) {
      io.to('auction:' + auction._id).emit('auction_resumed', { auction_id: String(auction._id), remaining_seconds: remaining, end_time: newEndTime.toISOString() });
      io.emit('auction_status_changed', { auction_id: String(auction._id), status: 'in_progress' });
    }

    const updated = await Auction.findById(req.params.id).populate('chit_group_id', 'group_name');
    res.json({ success: true, message: 'Auction resumed', data: updated });
  } catch (err) { next(err); }
});

router.get('/auctions/next-month/:groupId', adminOnly, async (req, res, next) => {
  try {
    // Exclude cancelled auctions so that cancelled month numbers can be reused
    const lastAuction = await Auction.findOne({
      chit_group_id: req.params.groupId,
      status: { $ne: 'cancelled' }
    }).sort({ month_number: -1 }).lean();
    const nextMonth = lastAuction ? lastAuction.month_number + 1 : 1;
    res.json({ success: true, data: { next_month: nextMonth } });
  } catch (err) { next(err); }
});

router.post('/auctions/:id/set-winner', adminOnly, async (req, res, next) => {
  try {
    const { winner_id, winning_bid_amount } = req.body;
    const auction = await Auction.findByIdAndUpdate(req.params.id, { status: 'completed', winner_id, winning_bid_amount, dividend_amount: winning_bid_amount, actual_end_time: new Date() }, { new: true })
      .populate('winner_id', 'full_name mobile').populate('chit_group_id', 'group_name');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    await ChitMember.findOneAndUpdate({ chit_group_id: auction.chit_group_id, user_id: winner_id }, { has_won_auction: true });
    res.json({ success: true, message: 'Winner set', data: auction });
  } catch (err) { next(err); }
});

// ============ WALLETS (Admin) ============
router.get('/wallets', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total = await Wallet.countDocuments();
    const wallets = await Wallet.find()
      .populate('user_id', 'full_name mobile member_id')
      .sort({ balance: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { wallets, total, page: parseInt(page) } });
  } catch (err) { next(err); }
});

router.post('/wallets/:userId/credit', adminOnly, async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const creditAmount = Number(amount);
    if (!creditAmount || creditAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const walletController = require('../controllers/walletController');
    const wallet = await walletController.getOrCreateWallet(req.params.userId);
    const newBalance = wallet.balance + creditAmount;
    await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
    await WalletTransaction.create({
      user_id: req.params.userId, wallet_id: wallet._id, type: 'deposit',
      amount: creditAmount, balance_after: newBalance,
      description: description || 'Admin credit',
    });
    notifyUser(req.params.userId, 'Wallet Credited 💰', `₹${creditAmount} has been credited to your wallet. New balance: ₹${newBalance}`, 'wallet_update').catch(() => {});
    res.json({ success: true, message: 'Wallet credited', data: { balance: newBalance } });
  } catch (err) { next(err); }
});

// ============ DISBURSALS ============
router.get('/disbursals', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { status: 'completed' };
    if (status) filter.disbursement_status = status;
    const total = await Auction.countDocuments(filter);
    const raw = await Auction.find(filter)
      .populate('winner_id', 'full_name mobile bank_account_number bank_ifsc_code').populate('chit_group_id', 'group_name chit_value')
      .sort({ actual_end_time: -1, created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    // Map to the shape the admin frontend expects
    const disbursals = raw.map(a => ({
      auction_id: a._id.toString(),
      group_name: a.chit_group_id?.group_name || '—',
      chit_value: a.chit_group_id?.chit_value || 0,
      month_number: a.month_number,
      winning_bid_amount: a.winning_bid_amount || 0,
      commission_amount: a.commission_amount || 0,
      discount_amount: a.discount_amount || 0,
      dividend_amount: a.dividend_amount || 0,
      dividend_per_member: a.dividend_per_member || 0,
      disbursal_amount: a.disbursement_amount || a.winning_bid_amount || 0,
      status: a.disbursement_status || 'pending',
      reference_number: a.utr_number || a.transaction_reference || null,
      winner_name: a.winner_id?.full_name || null,
      winner_mobile: a.winner_id?.mobile || null,
      bank_account_number: a.winner_id?.bank_account_number || null,
      bank_ifsc_code: a.winner_id?.bank_ifsc_code || null,
    }));
    res.json({ success: true, data: { disbursals, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// PUT aliases so the admin frontend can use PUT /admin/disbursals/:id/disburse and /reject
router.put('/disbursals/:auctionId/disburse', adminOnly, async (req, res, next) => {
  try {
    const { reference_number } = req.body;
    const auction = await Auction.findByIdAndUpdate(
      req.params.auctionId,
      { disbursement_status: 'disbursed', utr_number: reference_number, disbursement_date: new Date(), disbursement_approved_at: new Date(), disbursement_approved_by: req.user._id },
      { new: true }
    ).populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.winner_id) notifyUser(auction.winner_id._id, 'Amount Disbursed 🏦', `Your chit amount has been disbursed. Reference: ${reference_number || 'N/A'}`, 'disbursal_update').catch(() => {});
    res.json({ success: true, message: 'Disbursal approved and marked as disbursed', data: auction });
  } catch (err) { next(err); }
});

router.put('/disbursals/:auctionId/reject', adminOnly, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const auction = await Auction.findByIdAndUpdate(
      req.params.auctionId,
      { disbursement_status: 'rejected', notes: reason },
      { new: true }
    );
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Disbursal rejected', data: auction });
  } catch (err) { next(err); }
});

router.post('/disbursals/:auctionId/approve', adminOnly, async (req, res, next) => {
  try {
    const auction = await Auction.findByIdAndUpdate(req.params.auctionId, { disbursement_status: 'approved', disbursement_approved_at: new Date(), disbursement_approved_by: req.user._id || req.user.id }, { new: true })
      .populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.winner_id) notifyUser(auction.winner_id._id, 'Disbursement Approved 💰', `Your disbursement of ₹${auction.dividend_amount || auction.winning_bid_amount} has been approved. Transfer within 2 business days.`, 'disbursal_update').catch(() => {});
    res.json({ success: true, message: 'Disbursal approved', data: auction });
  } catch (err) { next(err); }
});

router.post('/disbursals/:auctionId/mark-disbursed', adminOnly, async (req, res, next) => {
  try {
    const { utr_number, disbursement_date } = req.body;
    const auction = await Auction.findByIdAndUpdate(req.params.auctionId, { disbursement_status: 'disbursed', utr_number, disbursement_date: disbursement_date ? new Date(disbursement_date) : new Date() }, { new: true })
      .populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.winner_id) notifyUser(auction.winner_id._id, 'Amount Disbursed 🏦', `Your chit amount of ₹${auction.dividend_amount || auction.winning_bid_amount} has been disbursed. UTR: ${utr_number || 'N/A'}`, 'disbursal_update').catch(() => {});
    res.json({ success: true, message: 'Marked as disbursed', data: auction });
  } catch (err) { next(err); }
});

// ============ PAYMENTS ============
router.get('/payments', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, chit_group_id, user_id, from_date, to_date } = req.query;
    const filter = {};
    if (status) filter.payment_status = status;
    if (chit_group_id) filter.chit_group_id = chit_group_id;
    if (user_id) filter.user_id = user_id;
    if (from_date || to_date) {
      filter.payment_date = {};
      if (from_date) filter.payment_date.$gte = new Date(from_date);
      if (to_date) filter.payment_date.$lte = new Date(to_date + 'T23:59:59');
    }
    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number')
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    const revenueAgg = await Payment.aggregate([{ $match: { payment_status: 'success' } }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]);
    res.json({ success: true, data: { payments, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalRevenue: revenueAgg[0]?.total || 0 } });
  } catch (err) { next(err); }
});

router.post('/payments/record', adminOnly, async (req, res, next) => {
  try {
    const { user_id, chit_group_id, month_number, amount, payment_method, payment_type = 'installment', notes } = req.body;
    const member = await ChitMember.findOne({ chit_group_id, user_id, is_active: true });
    if (!member) return res.status(400).json({ success: false, message: 'User is not a member' });
    const existing = await Payment.findOne({ chit_group_id, user_id, month_number, payment_status: 'success' });
    if (existing) return res.status(400).json({ success: false, message: 'Month already paid' });
    const count = await Payment.countDocuments();
    const payment = await Payment.create({
      payment_number: 'PAY' + new Date().getFullYear() + String(count + 1).padStart(6, '0'),
      user_id, chit_group_id, month_number, payment_type, amount: parseFloat(amount),
      total_amount: parseFloat(amount), payment_method: payment_method || 'cash',
      payment_gateway: 'Manual', payment_status: 'success', payment_date: new Date(), notes,
    });
    notifyUser(user_id, 'Payment Received ✅', `Your payment of ₹${parseFloat(amount)} for month ${month_number} has been recorded successfully.`, 'payment_received').catch(() => {});
    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (err) { next(err); }
});

// ============ BRANCHES ============
router.get('/branches', adminOnly, async (req, res, next) => {
  try {
    const branches = await Branch.find().sort({ created_at: -1 });
    res.json({ success: true, data: branches });
  } catch (err) { next(err); }
});

router.post('/branches', adminOnly, async (req, res, next) => {
  try {
    const branch = await Branch.create(req.body);
    res.status(201).json({ success: true, message: 'Branch created', data: branch });
  } catch (err) { next(err); }
});

router.put('/branches/:id', adminOnly, async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Branch updated', data: branch });
  } catch (err) { next(err); }
});

router.delete('/branches/:id', adminOnly, async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Branch deleted' });
  } catch (err) { next(err); }
});

// ============ COMMUNICATIONS ============
router.get('/communications', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, channel, from_date } = req.query;
    const filter = {};
    if (channel) filter.channel = channel;
    else if (type && ['sms', 'email', 'whatsapp', 'push', 'notification'].includes(type)) filter.channel = type;
    if (type && !['sms', 'email', 'whatsapp', 'push', 'notification'].includes(type)) filter.type = type;
    if (from_date) filter.created_at = { $gte: new Date(from_date) };
    const total = await CommunicationLog.countDocuments(filter);
    const logs = await CommunicationLog.find(filter)
      .populate('user_id', 'full_name mobile')
      .populate('sent_by', 'full_name')
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/communications/send', adminOnly, async (req, res, next) => {
  try {
    const { user_ids, subject, message } = req.body;
    const type = req.body.type || req.body.channel;
    const recipientType = req.body.recipient_type || 'all';
    const send_to_all = req.body.send_to_all === true || recipientType === 'all';
    if (!message) return res.status(400).json({ success: false, message: 'message required' });
    const adminId = req.user._id || req.user.id;

    let targets = [];
    if (user_ids?.length) {
      // Individual send
      targets = await User.find({ _id: { $in: user_ids } }).select('_id mobile email full_name fcm_token');
    } else if (recipientType === 'overdue') {
      // Overdue members — members with pending payments
      const overdueMemberIds = await Payment.distinct('user_id', { status: 'pending' });
      targets = await User.find({ _id: { $in: overdueMemberIds }, is_active: true }).select('_id mobile email full_name fcm_token');
    } else if (recipientType === 'kyc_pending') {
      targets = await User.find({ role: 'member', is_active: true, kyc_status: { $ne: 'verified' } }).select('_id mobile email full_name fcm_token');
    } else {
      // All active members
      targets = await User.find({ role: 'member', is_active: true }).select('_id mobile email full_name fcm_token');
    }
    if (!targets.length) return res.status(400).json({ success: false, message: 'No recipients found' });

    let sent = 0, failed = 0;
    for (const user of targets) {
      try {
        if (type === 'sms' && user.mobile) {
          await notificationService.sendSMS(user.mobile, message);
          await CommunicationLog.create({ user_id: user._id, channel: 'sms', type: 'sms', subject, message, status: 'sent', sent_by: adminId, recipient_type: recipientType, sent_at: new Date() });
          sent++;
        } else if (type === 'email' && user.email) {
          const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5">
<tr><td align="center" style="padding:20px 0">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="background-color:#1a237e;padding:24px;text-align:center;border-radius:8px 8px 0 0">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif">Assure ChitFunds</h1>
  </td></tr>
  <tr><td style="background-color:#ffffff;padding:24px 24px 32px;font-family:Arial,sans-serif;border:1px solid #e0e0e0;border-top:none">
    <p style="color:#333333;margin:0 0 8px;font-size:15px">Dear ${user.full_name || 'Member'},</p>
    ${subject ? `<h2 style="color:#1a237e;margin:16px 0 12px;font-size:18px">${subject}</h2>` : ''}
    <p style="color:#333333;line-height:1.6;font-size:14px;margin:0">${message.replace(/\n/g, '<br>')}</p>
    <p style="color:#333333;margin:24px 0 0;font-size:14px">Regards,<br>Team Assure ChitFunds</p>
  </td></tr>
  <tr><td style="padding:16px;text-align:center;font-family:Arial,sans-serif;border-radius:0 0 8px 8px">
    <p style="color:#999999;font-size:11px;margin:0">Assure ChitFunds, Hyderabad, India</p>
    <p style="color:#999999;font-size:11px;margin:4px 0 0">You are receiving this because you are a registered member of Assure ChitFunds.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
          await notificationService.sendEmail(user.email, subject || 'Message from Assure ChitFunds', htmlBody);
          await CommunicationLog.create({ user_id: user._id, channel: 'email', type: 'email', subject, message, status: 'sent', sent_by: adminId, recipient_type: recipientType, sent_at: new Date() });
          sent++;
        } else if (type === 'push') {
          // Create in-app notification
          await Notification.create({ user_id: user._id, title: subject || 'Notification', message, type: 'general', is_read: false, sent_at: new Date() });
          // Send FCM push if token exists
          if (user.fcm_token) {
            const pushResult = await sendPushNotification(user.fcm_token, subject || 'Notification', message, { type: 'general' });
            if (pushResult === 'INVALID_TOKEN') {
              await User.findByIdAndUpdate(user._id, { $unset: { fcm_token: 1 } });
            }
          }
          await CommunicationLog.create({ user_id: user._id, channel: 'push', type: 'notification', subject, message, status: 'sent', sent_by: adminId, recipient_type: recipientType, sent_at: new Date() });
          sent++;
        } else {
          // Default: in-app notification
          await Notification.create({ user_id: user._id, title: subject || 'Notification', message, type: 'general', is_read: false, sent_at: new Date() });
          await CommunicationLog.create({ user_id: user._id, channel: type || 'push', type: type || 'notification', subject, message, status: 'sent', sent_by: adminId, recipient_type: recipientType, sent_at: new Date() });
          sent++;
        }
      } catch (e) {
        failed++;
        await CommunicationLog.create({ user_id: user._id, channel: type || 'push', type, subject, message, status: 'failed', sent_by: adminId, error_message: e.message, recipient_type: recipientType, sent_at: new Date() });
      }
    }
    res.json({ success: true, message: `Communication sent: ${sent} delivered, ${failed} failed`, data: { sent, failed, total: targets.length } });
  } catch (err) { next(err); }
});

// ============ SUPPORT TICKETS ============
router.get('/support/tickets', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, priority } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    const total = await SupportTicket.countDocuments(filter);
    const tickets = await SupportTicket.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('assigned_to', 'full_name')
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { tickets, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// POST create ticket (admin creates on behalf of user or as system ticket)
router.post('/support/tickets', adminOnly, async (req, res, next) => {
  try {
    const { subject, description, priority, user_id } = req.body;
    if (!subject || !description) return res.status(400).json({ success: false, message: 'Subject and description are required' });
    const ticket = await SupportTicket.create({ subject, description, priority: priority || 'medium', user_id: user_id || (req.user._id || req.user.id) });
    res.status(201).json({ success: true, message: 'Ticket created', data: ticket });
  } catch (err) { next(err); }
});

router.get('/support/tickets/:id', adminOnly, async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user_id', 'full_name mobile member_id email')
      .populate('assigned_to', 'full_name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) { next(err); }
});

router.put('/support/tickets/:id', adminOnly, async (req, res, next) => {
  try {
    const { status, priority, assigned_to, resolution_notes, resolution } = req.body;
    const update = {};
    if (status !== undefined) { update.status = status; if (status === 'resolved') update.resolved_at = new Date(); }
    if (priority !== undefined) update.priority = priority;
    if (assigned_to !== undefined) update.assigned_to = assigned_to;
    // Accept both 'resolution' (admin sends this) and 'resolution_notes'; save to model field 'resolution'
    const resText = resolution_notes || resolution;
    if (resText !== undefined) update.resolution = resText;
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true }).populate('user_id', 'full_name mobile');
    if (!ticket) return res.status(404).json({ success: false, message: 'Not found' });
    // Notify user about ticket update
    if (ticket.user_id) {
      const statusMsg = status === 'resolved' ? 'Your support ticket has been resolved.' : status === 'in_progress' ? 'Your support ticket is being worked on.' : status === 'closed' ? 'Your support ticket has been closed.' : 'Your support ticket has been updated.';
      const resolutionMsg = resText ? ` Reply: ${resText}` : '';
      notifyUser(ticket.user_id._id || ticket.user_id, `Ticket Updated 🎫`, `${statusMsg}${resolutionMsg}`, 'support_update', { ticket_id: String(ticket._id) }).catch(() => {});
    }
    res.json({ success: true, message: 'Ticket updated', data: ticket });
  } catch (err) { next(err); }
});

// ============ SETTINGS ============
router.get('/settings', adminOnly, async (req, res, next) => {
  try {
    const settings = await AppSetting.find();
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json({ success: true, data: obj });
  } catch (err) { next(err); }
});

router.put('/settings', superAdminOnly, async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await AppSetting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) { next(err); }
});

// ============ ACCOUNTING (Double-Entry Bookkeeping) ============

// Seed chart of accounts on first load
router.get('/accounting/seed', adminOnly, async (req, res, next) => {
  try {
    const result = await accountingService.seedChartOfAccounts();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Accounting dashboard summary
router.get('/accounting/summary', adminOnly, async (req, res, next) => {
  try {
    await accountingService.seedChartOfAccounts(); // auto-seed if empty
    const data = await accountingService.getAccountingSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Chart of Accounts — tree structure
router.get('/accounting/chart-of-accounts', adminOnly, async (req, res, next) => {
  try {
    await accountingService.seedChartOfAccounts();
    const accounts = await Account.find({ is_active: true }).sort({ account_number: 1, name: 1 }).lean();
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

// Create new account
router.post('/accounting/accounts', adminOnly, async (req, res, next) => {
  try {
    const { name, account_number, parent_account, root_type, account_type, is_group, description } = req.body;
    if (!name || !root_type) return res.status(400).json({ success: false, message: 'name and root_type required' });
    if (parent_account) {
      const parent = await Account.findOne({ name: parent_account });
      if (!parent) return res.status(400).json({ success: false, message: `Parent account "${parent_account}" not found` });
      if (!parent.is_group) return res.status(400).json({ success: false, message: 'Parent must be a group account' });
    }
    const account = await Account.create({ name, account_number, parent_account, root_type, account_type, is_group: is_group || false, description });
    res.json({ success: true, data: account });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Account name already exists' });
    next(err);
  }
});

// Update account
router.put('/accounting/accounts/:name', adminOnly, async (req, res, next) => {
  try {
    const { description, is_active, account_number } = req.body;
    const update = {};
    if (description !== undefined) update.description = description;
    if (is_active !== undefined) update.is_active = is_active;
    if (account_number !== undefined) update.account_number = account_number;
    const account = await Account.findOneAndUpdate({ name: decodeURIComponent(req.params.name) }, update, { new: true });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
});

// Journal Entries — list
router.get('/accounting/journal-entries', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, from, to, voucher_type, group_id } = req.query;
    const filter = { is_cancelled: false };
    if (from || to) {
      filter.posting_date = {};
      if (from) filter.posting_date.$gte = new Date(from);
      if (to) filter.posting_date.$lte = new Date(to + 'T23:59:59');
    }
    if (voucher_type && voucher_type !== 'all') filter.voucher_type = voucher_type;
    if (group_id) filter.chit_group_id = group_id;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [entries, total] = await Promise.all([
      JournalEntry.find(filter).populate('chit_group_id', 'group_name').sort({ posting_date: -1, created_at: -1 }).skip(skip).limit(parseInt(limit)),
      JournalEntry.countDocuments(filter),
    ]);
    res.json({ success: true, data: entries, total });
  } catch (err) { next(err); }
});

// Create manual journal entry
router.post('/accounting/journal-entries', adminOnly, async (req, res, next) => {
  try {
    const { voucher_type, posting_date, items, user_remark, title, chit_group_id } = req.body;
    if (!items?.length) return res.status(400).json({ success: false, message: 'items required' });
    const entry = await accountingService.createJournalEntry({
      voucher_type: voucher_type || 'Journal Entry',
      posting_date: posting_date || new Date(),
      items,
      user_remark,
      title,
      chit_group_id,
      posted_by: req.user._id || req.user.id,
    });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Cancel journal entry
router.post('/accounting/journal-entries/:id/cancel', adminOnly, async (req, res, next) => {
  try {
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    if (entry.is_cancelled) return res.status(400).json({ success: false, message: 'Already cancelled' });
    // Reverse account balances
    const accounts = await Account.find({ name: { $in: entry.items.map(i => i.account) } }).lean();
    const accountMap = {};
    accounts.forEach(a => { accountMap[a.name] = a; });
    for (const item of entry.items) {
      const acc = accountMap[item.account];
      if (!acc) continue;
      const isDebitNature = ['Asset', 'Expense'].includes(acc.root_type);
      const reverseChange = isDebitNature
        ? -((item.debit || 0) - (item.credit || 0))
        : -((item.credit || 0) - (item.debit || 0));
      await Account.findOneAndUpdate({ name: item.account }, { $inc: { balance: reverseChange } });
    }
    entry.is_cancelled = true;
    entry.cancelled_at = new Date();
    await entry.save();
    res.json({ success: true, message: 'Journal entry cancelled', data: entry });
  } catch (err) { next(err); }
});

// General Ledger
router.get('/accounting/general-ledger', adminOnly, async (req, res, next) => {
  try {
    const { from, to, account, party, page = 1, limit = 100 } = req.query;
    const data = await accountingService.getGeneralLedger({
      from_date: from, to_date: to, account, party,
      page: parseInt(page), limit: parseInt(limit),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Trial Balance
router.get('/accounting/trial-balance', adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await accountingService.getTrialBalance({ from_date: from, to_date: to });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Profit & Loss
router.get('/accounting/pl', adminOnly, async (req, res, next) => {
  try {
    await accountingService.seedChartOfAccounts();
    const { from, to, group_id } = req.query;
    const data = await accountingService.getProfitAndLoss({ from_date: from, to_date: to, group_id });

    // Also include legacy summary for backward compat
    const [revenueAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { payment_status: 'success' } },
        { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
      ]),
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;
    const totalCount = revenueAgg[0]?.count || 0;
    const months = buildMonths(6);
    const monthlyPL = await getMonthlyCollections(months);
    const monthly = monthlyPL.map(m => ({ month: m.month, collection: m.amount, profit: Math.round(m.amount * 0.05) }));

    res.json({
      success: true,
      data: {
        ...data,
        // Legacy fields
        summary: {
          total_collected: totalRevenue,
          total_commission: data.total_income > 0 ? data.total_income : Math.round(totalRevenue * 0.05),
          total_late_fees: 0,
          successful_payments: totalCount,
        },
        monthly: data.monthly.length > 0 ? data.monthly : monthly,
      },
    });
  } catch (err) { next(err); }
});

// Balance Sheet
router.get('/accounting/balance-sheet', adminOnly, async (req, res, next) => {
  try {
    const { as_of_date } = req.query;
    const data = await accountingService.getBalanceSheet({ as_of_date });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Cash Flow Statement
router.get('/accounting/cash-flow', adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await accountingService.getCashFlow({ from_date: from, to_date: to });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Accounts Receivable
router.get('/accounting/receivable', adminOnly, async (req, res, next) => {
  try {
    const data = await accountingService.getAccountsReceivable();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Group-wise P&L
router.get('/accounting/group-pl', adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await accountingService.getGroupWisePL({ from_date: from, to_date: to });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Bulk post historical payments
router.post('/accounting/bulk-post', adminOnly, async (req, res, next) => {
  try {
    const data = await accountingService.bulkPostHistoricalPayments();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Live sync status
router.get('/accounting/sync-status', adminOnly, async (req, res) => {
  res.json({ success: true, data: accountingService.getSyncStatus() });
});

// Start auto-sync (every 60s)
router.post('/accounting/auto-sync/start', adminOnly, async (req, res) => {
  const interval = Math.max(Number(req.body.interval) || 60000, 10000);
  accountingService.startAutoSync(interval);
  res.json({ success: true, message: 'Auto-sync started', interval });
});

// Stop auto-sync
router.post('/accounting/auto-sync/stop', adminOnly, async (req, res) => {
  accountingService.stopAutoSync();
  res.json({ success: true, message: 'Auto-sync stopped' });
});

// Manual trigger sync
router.post('/accounting/sync-now', adminOnly, async (req, res, next) => {
  try {
    await accountingService.runAutoSync();
    res.json({ success: true, data: accountingService.getSyncStatus() });
  } catch (err) { next(err); }
});

// Fiscal Years
router.get('/accounting/fiscal-years', adminOnly, async (req, res, next) => {
  try {
    const data = await FiscalYear.find().sort({ start_date: -1 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Payment Ledger (legacy — enhanced)
router.get('/accounting/ledger', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, from, to, type } = req.query;
    const filter = {};
    if (from || to) {
      filter.payment_date = {};
      if (from) filter.payment_date.$gte = new Date(from);
      if (to) filter.payment_date.$lte = new Date(to + 'T23:59:59');
    }
    if (type && type !== 'all') filter.payment_type = type;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total, sumAgg] = await Promise.all([
      Payment.find(filter).populate('user_id', 'full_name mobile member_id').populate('chit_group_id', 'group_name').sort({ payment_date: -1 }).skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]),
    ]);
    res.json({ success: true, data: payments, total, totalAmount: sumAgg[0]?.total || 0 });
  } catch (err) { next(err); }
});

// ============ DEFAULTERS ============
router.get('/defaulters', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, risk, group_id, reminders_filter, search } = req.query;
    const now = new Date();

    // 1. Get overdue Payment records
    const overdueFilter = { payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: now } };
    const overduePayments = await Payment.find(overdueFilter)
      .populate('user_id', 'full_name mobile member_id credit_score fcm_token')
      .populate('chit_group_id', 'group_name group_number chit_value commencement_date duration_months')
      .sort({ due_date: 1 }).lean();

    // 2. Generate virtual defaulter entries from schedule
    const activeGroups = await ChitGroup.find({ status: { $in: ['active', 'started'] } })
      .select('group_name group_number chit_value commencement_date duration_months').lean();
    const members = await ChitMember.find({ is_active: true, chit_group_id: { $in: activeGroups.map(g => g._id) } })
      .populate('user_id', 'full_name mobile member_id credit_score fcm_token').lean();
    const paidPayments = await Payment.find({ payment_status: 'success' }).select('user_id chit_group_id month_number').lean();
    const paidSet = new Set(paidPayments.map(p => String(p.user_id) + '-' + String(p.chit_group_id) + '-' + p.month_number));
    const existingSet = new Set(overduePayments.map(p => String(p.user_id?._id || p.user_id) + '-' + String(p.chit_group_id?._id || p.chit_group_id) + '-' + p.month_number));

    const virtualEntries = [];
    for (const group of activeGroups) {
      if (!group.commencement_date) continue;
      const start = new Date(group.commencement_date);
      const monthlyAmount = Math.round(group.chit_value / group.duration_months);
      const groupMembers = members.filter(m => String(m.chit_group_id) === String(group._id));

      for (const mem of groupMembers) {
        if (!mem.user_id) continue;
        for (let mo = 1; mo <= group.duration_months; mo++) {
          const dueDate = new Date(start);
          dueDate.setMonth(dueDate.getMonth() + (mo - 1));
          if (dueDate >= now) break;
          const key = String(mem.user_id._id) + '-' + String(group._id) + '-' + mo;
          if (paidSet.has(key) || existingSet.has(key)) continue;
          virtualEntries.push({
            _id: null, virtual: true,
            user_id: mem.user_id,
            chit_group_id: group,
            month_number: mo,
            amount: monthlyAmount, total_amount: monthlyAmount, late_fee: 0,
            due_date: dueDate, payment_status: 'overdue',
          });
        }
      }
    }

    // 3. Get all defaulter actions for reminder counts
    const allActions = await DefaulterAction.find({
      action_type: { $in: ['reminder_1', 'reminder_2', 'reminder_3', 'legal_notice'] }
    }).select('user_id chit_group_id action_type created_at').lean();

    const actionMap = {};
    for (const a of allActions) {
      const key = String(a.user_id) + '-' + String(a.chit_group_id);
      if (!actionMap[key]) actionMap[key] = { reminders_sent: 0, last_reminder_at: null, legal_notice_sent: false, legal_notice_at: null };
      if (a.action_type.startsWith('reminder_')) {
        const num = parseInt(a.action_type.split('_')[1]);
        actionMap[key].reminders_sent = Math.max(actionMap[key].reminders_sent, num);
        if (!actionMap[key].last_reminder_at || a.created_at > actionMap[key].last_reminder_at) {
          actionMap[key].last_reminder_at = a.created_at;
        }
      }
      if (a.action_type === 'legal_notice') {
        actionMap[key].legal_notice_sent = true;
        actionMap[key].legal_notice_at = a.created_at;
      }
    }

    let allRows = [...overduePayments, ...virtualEntries];
    allRows = allRows.map(r => {
      const days = r.due_date ? Math.ceil((now - new Date(r.due_date)) / 86400000) : 0;
      const riskLevel = days > 21 ? 'high' : days >= 14 ? 'medium' : 'low';
      const uid = String(r.user_id?._id || r.user_id);
      const gid = String(r.chit_group_id?._id || r.chit_group_id);
      const actions = actionMap[uid + '-' + gid] || { reminders_sent: 0, last_reminder_at: null, legal_notice_sent: false, legal_notice_at: null };
      return { ...r, days_overdue: days, risk: riskLevel, ...actions };
    });

    // Filters
    if (risk && risk !== 'all') allRows = allRows.filter(r => r.risk === risk);
    if (group_id && group_id !== 'all') allRows = allRows.filter(r => String(r.chit_group_id?._id || r.chit_group_id) === group_id);
    if (reminders_filter && reminders_filter !== 'all') {
      const rf = parseInt(reminders_filter);
      allRows = allRows.filter(r => r.reminders_sent === rf);
    }
    if (search) {
      const s = search.toLowerCase();
      allRows = allRows.filter(r =>
        (r.user_id?.full_name || '').toLowerCase().includes(s) ||
        (r.user_id?.mobile || '').includes(s) ||
        (r.user_id?.member_id || '').toLowerCase().includes(s)
      );
    }

    allRows.sort((a, b) => b.days_overdue - a.days_overdue);
    const total = allRows.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paged = allRows.slice(skip, skip + parseInt(limit));

    const high = allRows.filter(r => r.risk === 'high').length;
    const medium = allRows.filter(r => r.risk === 'medium').length;
    const low = allRows.filter(r => r.risk === 'low').length;
    const noReminder = allRows.filter(r => r.reminders_sent === 0).length;
    const legalSent = allRows.filter(r => r.legal_notice_sent).length;

    // Get groups list for filter dropdown
    const groups = activeGroups.map(g => ({ _id: g._id, group_name: g.group_name }));

    res.json({
      success: true, data: paged, total,
      stats: { high, medium, low, total, noReminder, legalSent },
      groups, page: parseInt(page)
    });
  } catch (err) { next(err); }
});

// Send reminder (push + SMS) to a defaulter — tracks action
router.post('/defaulters/send-reminder', adminOnly, async (req, res, next) => {
  try {
    const { user_id, chit_group_id, payment_id, mobile, name, days_overdue, amount, group_name, reminder_number, channels } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'User ID required' });

    const rn = Math.min(Math.max(parseInt(reminder_number) || 1, 1), 3);
    const sendChannels = channels || ['sms', 'push'];

    // Check if this reminder was already sent
    const existing = await DefaulterAction.findOne({
      user_id, chit_group_id, action_type: `reminder_${rn}`
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `Reminder ${rn} already sent to this member for this group on ${new Date(existing.created_at).toLocaleDateString('en-IN')}` });
    }

    // Ensure reminders are sent in order
    if (rn > 1) {
      const prev = await DefaulterAction.findOne({ user_id, chit_group_id, action_type: `reminder_${rn - 1}` });
      if (!prev) return res.status(400).json({ success: false, message: `Must send reminder ${rn - 1} first` });
    }

    const msgs = {
      1: `Dear ${name}, this is a reminder that your chit fund installment of Rs.${amount} for ${group_name} is overdue by ${days_overdue} days. Please pay immediately to avoid penalties. - Assure ChitFunds`,
      2: `URGENT: Dear ${name}, your payment of Rs.${amount} for ${group_name} is now ${days_overdue} days overdue. This is your 2nd reminder. Continued default will affect your credit score. - Assure ChitFunds`,
      3: `FINAL NOTICE: Dear ${name}, your overdue amount of Rs.${amount} for ${group_name} (${days_overdue} days) requires immediate payment. Legal action will be initiated if not paid within 7 days. - Assure ChitFunds`,
    };
    const msg = msgs[rn];

    const pushTitle = rn === 3 ? '⚠️ FINAL NOTICE - Payment Overdue' : rn === 2 ? '🔴 URGENT - Payment Overdue' : '🔔 Payment Reminder';
    const pushBody = rn === 3
      ? `Your payment of Rs.${amount} for ${group_name} is ${days_overdue} days overdue. Legal action will follow if not paid within 7 days.`
      : rn === 2
        ? `Your payment of Rs.${amount} for ${group_name} is ${days_overdue} days overdue. Your credit score will be affected.`
        : `Your chit fund installment of Rs.${amount} for ${group_name} is overdue by ${days_overdue} days. Please pay now.`;

    const channelsUsed = [];
    let smsOk = false, pushOk = false;

    // Send SMS
    if (sendChannels.includes('sms') && mobile) {
      try {
        await notificationService.sendSMS(mobile, msg);
        smsOk = true;
        channelsUsed.push('sms');
      } catch (e) { logger.warn('Defaulter SMS failed:', e.message); }
    }

    // Send Push Notification
    if (sendChannels.includes('push')) {
      const user = await User.findById(user_id).select('fcm_token').lean();
      if (user?.fcm_token) {
        try {
          const pushResult = await sendPushNotification(user.fcm_token, pushTitle, pushBody, {
            type: 'defaulter_reminder', reminder_number: String(rn), group_name: group_name || '',
          });
          if (pushResult === 'INVALID_TOKEN') {
            await User.findByIdAndUpdate(user_id, { $unset: { fcm_token: 1 } });
          } else if (pushResult) {
            pushOk = true;
            channelsUsed.push('push');
          }
        } catch (e) { logger.warn('Defaulter push failed:', e.message); }
      }
    }

    // Create in-app notification
    await Notification.create({
      user_id, type: 'payment_reminder',
      title: pushTitle.replace(/[⚠️🔴🔔]\s?/g, ''),
      message: pushBody,
      data: { reminder_number: rn, group_name, amount, days_overdue },
      delivery_method: channelsUsed.length ? channelsUsed : ['push'],
      sent_at: new Date(),
    });

    // Track the action
    await DefaulterAction.create({
      user_id, chit_group_id, payment_id: payment_id || undefined,
      action_type: `reminder_${rn}`,
      channels: channelsUsed.length ? channelsUsed : sendChannels,
      message: msg,
      details: { days_overdue, amount, group_name, sms_sent: smsOk, push_sent: pushOk },
      performed_by: req.user._id || req.user.id,
    });

    // Auto-penalize credit on 3rd reminder
    if (rn === 3) {
      await User.findByIdAndUpdate(user_id, { $inc: { credit_score: -25 } });
    }

    res.json({
      success: true,
      message: `Reminder ${rn} sent to ${name}`,
      channels_used: channelsUsed,
      sms_sent: smsOk, push_sent: pushOk,
    });
  } catch (err) { next(err); }
});

// Bulk send reminders to filtered defaulters
router.post('/defaulters/bulk-remind', adminOnly, async (req, res, next) => {
  try {
    const { targets, reminder_number, channels } = req.body;
    if (!Array.isArray(targets) || !targets.length) return res.status(400).json({ success: false, message: 'No targets' });

    const rn = Math.min(Math.max(parseInt(reminder_number) || 1, 1), 3);
    let sent = 0, skipped = 0, failed = 0;

    for (const t of targets) {
      // Check if already sent
      const existing = await DefaulterAction.findOne({
        user_id: t.user_id, chit_group_id: t.chit_group_id, action_type: `reminder_${rn}`
      });
      if (existing) { skipped++; continue; }

      // Check ordering
      if (rn > 1) {
        const prev = await DefaulterAction.findOne({
          user_id: t.user_id, chit_group_id: t.chit_group_id, action_type: `reminder_${rn - 1}`
        });
        if (!prev) { skipped++; continue; }
      }

      const msgs = {
        1: `Dear ${t.name}, your chit fund installment of Rs.${t.amount} for ${t.group_name} is overdue by ${t.days_overdue} days. Please pay immediately. - Assure ChitFunds`,
        2: `URGENT: Dear ${t.name}, your payment of Rs.${t.amount} for ${t.group_name} is ${t.days_overdue} days overdue. 2nd reminder. Credit score will be affected. - Assure ChitFunds`,
        3: `FINAL NOTICE: Dear ${t.name}, your overdue amount of Rs.${t.amount} for ${t.group_name} (${t.days_overdue} days) requires immediate payment. Legal action to follow. - Assure ChitFunds`,
      };
      const pushTitle = rn === 3 ? 'FINAL NOTICE - Payment Overdue' : rn === 2 ? 'URGENT - Payment Overdue' : 'Payment Reminder';
      const pushBody = `Your payment of Rs.${t.amount} for ${t.group_name} is ${t.days_overdue} days overdue.`;

      const channelsUsed = [];
      const sendCh = channels || ['sms', 'push'];

      if (sendCh.includes('sms') && t.mobile) {
        try { await notificationService.sendSMS(t.mobile, msgs[rn]); channelsUsed.push('sms'); } catch (e) {}
      }
      if (sendCh.includes('push')) {
        const user = await User.findById(t.user_id).select('fcm_token').lean();
        if (user?.fcm_token) {
          try {
            const r = await sendPushNotification(user.fcm_token, pushTitle, pushBody, { type: 'defaulter_reminder', reminder_number: String(rn) });
            if (r === 'INVALID_TOKEN') await User.findByIdAndUpdate(t.user_id, { $unset: { fcm_token: 1 } });
            else if (r) channelsUsed.push('push');
          } catch (e) {}
        }
      }

      await Notification.create({
        user_id: t.user_id, type: 'payment_reminder',
        title: pushTitle, message: pushBody,
        data: { reminder_number: rn, group_name: t.group_name, amount: t.amount },
        delivery_method: channelsUsed.length ? channelsUsed : ['push'], sent_at: new Date(),
      });

      await DefaulterAction.create({
        user_id: t.user_id, chit_group_id: t.chit_group_id,
        action_type: `reminder_${rn}`, channels: channelsUsed.length ? channelsUsed : sendCh,
        message: msgs[rn],
        details: { days_overdue: t.days_overdue, amount: t.amount, group_name: t.group_name },
        performed_by: req.user._id || req.user.id,
      });

      if (rn === 3) await User.findByIdAndUpdate(t.user_id, { $inc: { credit_score: -25 } });
      sent++;
    }

    res.json({ success: true, message: `Reminder ${rn} sent to ${sent} members, ${skipped} skipped`, sent, skipped, failed });
  } catch (err) { next(err); }
});

// Send legal notice to multiple defaulters
router.post('/defaulters/send-legal-notice', adminOnly, async (req, res, next) => {
  try {
    const { defaulters: targets } = req.body;
    if (!Array.isArray(targets) || !targets.length) return res.status(400).json({ success: false, message: 'No defaulters selected' });
    let sent = 0, skipped = 0;
    for (const t of targets) {
      // Check if legal notice already sent
      const existing = await DefaulterAction.findOne({
        user_id: t.user_id, chit_group_id: t.chit_group_id, action_type: 'legal_notice'
      });
      if (existing) { skipped++; continue; }

      const msg = `LEGAL NOTICE: Dear ${t.name}, legal proceedings will be initiated against you for non-payment of Rs.${t.amount} towards ${t.group_name} chit fund (overdue ${t.days_overdue} days). Settle immediately. Ref: ${t.user_id || 'N/A'}. - Assure ChitFunds (Legal Dept)`;
      const pushTitle = '⚖️ Legal Notice Issued';
      const pushBody = `Legal proceedings initiated for non-payment of Rs.${t.amount} for ${t.group_name}. Please settle immediately.`;

      const channelsUsed = [];
      if (t.mobile) {
        try { await notificationService.sendSMS(t.mobile, msg); channelsUsed.push('sms'); } catch (e) {}
      }
      if (t.user_id) {
        const user = await User.findById(t.user_id).select('fcm_token').lean();
        if (user?.fcm_token) {
          try {
            const r = await sendPushNotification(user.fcm_token, pushTitle, pushBody, { type: 'legal_notice' });
            if (r === 'INVALID_TOKEN') await User.findByIdAndUpdate(t.user_id, { $unset: { fcm_token: 1 } });
            else if (r) channelsUsed.push('push');
          } catch (e) {}
        }
        // Penalize credit score
        await User.findByIdAndUpdate(t.user_id, { $inc: { credit_score: -100 } });

        await Notification.create({
          user_id: t.user_id, type: 'payment_reminder',
          title: 'Legal Notice Issued',
          message: pushBody,
          data: { type: 'legal_notice', group_name: t.group_name, amount: t.amount },
          delivery_method: channelsUsed.length ? channelsUsed : ['push'], sent_at: new Date(),
        });

        await DefaulterAction.create({
          user_id: t.user_id, chit_group_id: t.chit_group_id,
          action_type: 'legal_notice', channels: channelsUsed.length ? channelsUsed : ['sms'],
          message: msg,
          details: { days_overdue: t.days_overdue, amount: t.amount, group_name: t.group_name, credit_deducted: 100 },
          performed_by: req.user._id || req.user.id,
        });
      }
      sent++;
    }
    res.json({ success: true, message: `Legal notices sent to ${sent} members${skipped ? `, ${skipped} already had notices` : ''}`, sent, skipped });
  } catch (err) { next(err); }
});

// Get action history for a specific defaulter
router.get('/defaulters/:userId/actions', adminOnly, async (req, res, next) => {
  try {
    const { chit_group_id } = req.query;
    const filter = { user_id: req.params.userId };
    if (chit_group_id) filter.chit_group_id = chit_group_id;
    const actions = await DefaulterAction.find(filter)
      .populate('performed_by', 'full_name')
      .sort({ created_at: -1 }).lean();
    res.json({ success: true, data: actions });
  } catch (err) { next(err); }
});

router.put('/defaulters/:userId/penalize', adminOnly, async (req, res, next) => {
  try {
    const { credit_deduction, chit_group_id } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.credit_score = Math.max(0, (user.credit_score || 500) - (parseInt(credit_deduction) || 0));
    await user.save();

    // Track penalty action
    await DefaulterAction.create({
      user_id: req.params.userId,
      chit_group_id: chit_group_id || undefined,
      action_type: 'penalty',
      details: { credit_deduction: parseInt(credit_deduction), new_score: user.credit_score },
      performed_by: req.user._id || req.user.id,
    });

    res.json({ success: true, message: 'Credit score updated', data: { credit_score: user.credit_score } });
  } catch (err) { next(err); }
});

router.put('/defaulters/:paymentId/waive-fee', adminOnly, async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.paymentId, { late_fee: 0 }, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    await DefaulterAction.create({
      user_id: payment.user_id,
      chit_group_id: payment.chit_group_id,
      payment_id: payment._id,
      action_type: 'waiver',
      details: { waived_amount: payment.late_fee },
      performed_by: req.user._id || req.user.id,
    });

    res.json({ success: true, message: 'Late fee waived', data: payment });
  } catch (err) { next(err); }
});

// ============ DOCUMENTS (admin view) ============
router.get('/documents', adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, doc_type } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.verification_status = status === 'approved' ? 'verified' : status;
    }
    if (doc_type && doc_type !== 'all') {
      filter.document_type = doc_type;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      Document.find(filter).populate('user_id', 'full_name mobile member_id kyc_status email').sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)),
      Document.countDocuments(filter),
    ]);
    res.json({ success: true, data: docs, total });
  } catch (err) { next(err); }
});

router.put('/documents/:id/verify', adminOnly, async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    // Map 'approved' alias to the canonical 'verified' enum value
    const normalized = status === 'approved' ? 'verified' : status;
    const allowed = ['verified', 'rejected'];
    if (!allowed.includes(normalized)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await Document.findByIdAndUpdate(req.params.id, { verification_status: normalized, notes: remarks, verified_at: new Date(), verified_by: req.user._id }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// DELETE /admin/documents/:id — admin deletes a document (GridFS + DB), user must re-upload
router.delete('/documents/:id', adminOnly, async (req, res, next) => {
  try {
    const { deleteFromGridFS } = require('../utils/gridfs');
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    if (doc.gridfs_id) {
      try { await deleteFromGridFS(doc.gridfs_id); } catch (e) { /* file may already be deleted */ }
    }
    await Document.findByIdAndDelete(doc._id);
    res.json({ success: true, message: 'Document deleted. User will need to re-upload.' });
  } catch (err) { next(err); }
});

// ============ REPORTS ============
router.get('/reports', adminOnly, async (req, res, next) => {
  try {
    const { type = 'monthly_collection', period } = req.query;
    const now = new Date();
    let start, end;
    // Support YYYY-MM period format (sent by admin Reports.js date picker)
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [yr, mo] = period.split('-').map(Number);
      start = new Date(yr, mo - 1, 1);
      end = new Date(yr, mo, 0, 23, 59, 59, 999);
    } else if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); end = now; }
    else if (period === 'quarter') { start = new Date(now); start.setMonth(now.getMonth() - 3); end = now; }
    else if (period === 'year') { start = new Date(now.getFullYear(), 0, 1); end = now; }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }

    if (type === 'monthly_collection' || type === 'collection') {
      const matchFilter = { payment_status: 'success', payment_date: { $gte: start, $lte: end } };
      const [payments, totalAgg] = await Promise.all([
        Payment.find(matchFilter).populate('user_id', 'full_name member_id').populate('chit_group_id', 'group_name').sort({ payment_date: -1 }).limit(100),
        Payment.aggregate([{ $match: matchFilter }, { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }]),
      ]);
      const total = totalAgg[0]?.total || 0;
      return res.json({
        success: true,
        data: {
          summary: [
            { label: 'Total Collected', value: `₹${total.toLocaleString('en-IN')}`, color: '#4caf50' },
            { label: 'Payments Count', value: totalAgg[0]?.count || 0, color: '#2196f3' },
          ],
          data: payments.map(p => ({
            Payment_ID: p._id.toString().slice(-8).toUpperCase(),
            Member: p.user_id?.full_name || '—',
            Member_ID: p.user_id?.member_id || '—',
            Group: p.chit_group_id?.group_name || '—',
            Amount: `₹${Number(p.total_amount || 0).toLocaleString('en-IN')}`,
            Date: new Date(p.payment_date).toLocaleDateString('en-IN'),
          })),
        },
      });
    }

    if (type === 'overdue_payments' || type === 'defaulters') {
      const overdue = await Payment.find({ payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: now } })
        .populate('user_id', 'full_name mobile member_id').populate('chit_group_id', 'group_name').sort({ due_date: 1 }).limit(100);
      return res.json({
        success: true,
        data: {
          summary: [{ label: 'Overdue Payments', value: overdue.length, color: '#f44336' }],
          data: overdue.map(p => ({
            Member: p.user_id?.full_name || '—',
            Mobile: p.user_id?.mobile || '—',
            Group: p.chit_group_id?.group_name || '—',
            Amount: `₹${Number(p.total_amount || 0).toLocaleString('en-IN')}`,
            Due_Date: p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN') : '—',
            Status: p.payment_status,
          })),
        },
      });
    }

    if (type === 'kyc_status') {
      const [users, kycStats] = await Promise.all([
        User.find({ role: 'member' }).select('full_name mobile member_id kyc_status created_at').sort({ created_at: -1 }).limit(100),
        User.aggregate([{ $match: { role: 'member' } }, { $group: { _id: '$kyc_status', count: { $sum: 1 } } }]),
      ]);
      const sm = kycStats.reduce((a, s) => ({ ...a, [s._id]: s.count }), {});
      return res.json({
        success: true,
        data: {
          summary: [
            { label: 'Verified', value: sm.verified || 0, color: '#4caf50' },
            { label: 'Pending', value: sm.pending || 0, color: '#ff9800' },
            { label: 'Rejected', value: sm.rejected || 0, color: '#f44336' },
            { label: 'Not Submitted', value: sm.not_submitted || 0, color: '#9e9e9e' },
          ],
          data: users.map(u => ({
            Member: u.full_name,
            Mobile: u.mobile,
            Member_ID: u.member_id || '—',
            KYC_Status: u.kyc_status,
            Joined: new Date(u.created_at).toLocaleDateString('en-IN'),
          })),
        },
      });
    }

    if (type === 'group_status') {
      const groups = await ChitGroup.find().sort({ created_at: -1 }).limit(100);
      const sc = groups.reduce((a, g) => ({ ...a, [g.status]: (a[g.status] || 0) + 1 }), {});
      return res.json({
        success: true,
        data: {
          summary: Object.entries(sc).map(([st, cnt]) => ({
            label: st.charAt(0).toUpperCase() + st.slice(1),
            value: cnt,
            color: st === 'active' ? '#4caf50' : st === 'draft' ? '#9e9e9e' : st === 'completed' ? '#2196f3' : '#ff9800',
          })),
          data: groups.map(g => ({
            Group_Name: g.group_name,
            Group_Number: g.group_number,
            Chit_Value: `₹${Number(g.chit_value || 0).toLocaleString('en-IN')}`,
            Status: g.status,
            Duration: (g.duration_months || '—') + (g.duration_months ? ' months' : ''),
          })),
        },
      });
    }

    if (type === 'auction_summary') {
      const auctions = await Auction.find().populate('chit_group_id', 'group_name').populate('winner_id', 'full_name').sort({ created_at: -1 }).limit(100);
      const sc = auctions.reduce((a, au) => ({ ...a, [au.status]: (a[au.status] || 0) + 1 }), {});
      return res.json({
        success: true,
        data: {
          summary: Object.entries(sc).map(([st, cnt]) => ({
            label: st.charAt(0).toUpperCase() + st.slice(1),
            value: cnt,
            color: st === 'completed' ? '#4caf50' : st === 'active' ? '#f44336' : '#9e9e9e',
          })),
          data: auctions.map(a => ({
            Group: a.chit_group_id?.group_name || '—',
            Month: a.month_number,
            Status: a.status,
            Winner: a.winner_id?.full_name || '—',
            Winning_Bid: a.winning_bid_amount ? `₹${Number(a.winning_bid_amount).toLocaleString('en-IN')}` : '—',
          })),
        },
      });
    }

    if (type === 'members') {
      const members = await User.find({ role: 'member', created_at: { $gte: start, $lte: end } }).select('full_name email mobile member_id kyc_status created_at').sort({ created_at: -1 }).limit(100);
      return res.json({
        success: true,
        data: {
          summary: [{ label: 'New Members', value: members.length, color: '#2196f3' }],
          data: members.map(m => ({ Member: m.full_name, Email: m.email || '—', Mobile: m.mobile, Member_ID: m.member_id || '—', KYC: m.kyc_status, Joined: new Date(m.created_at).toLocaleDateString('en-IN') })),
        },
      });
    }

    res.status(400).json({ success: false, message: 'Unknown report type: ' + type });
  } catch (err) { next(err); }
});

router.get('/reports/export', adminOnly, async (req, res, next) => {
  try {
    const { type = 'collection', period = 'month' } = req.query;
    // Re-use the /reports logic; respond with download-friendly JSON
    const now = new Date();
    let start;
    if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
    else if (period === 'quarter') { start = new Date(now); start.setMonth(now.getMonth() - 3); }
    else if (period === 'year') { start = new Date(now.getFullYear(), 0, 1); }
    else { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    let data = [];
    if (type === 'collection') {
      data = await Payment.find({ payment_status: 'success', payment_date: { $gte: start } }).populate('user_id', 'full_name member_id').populate('chit_group_id', 'group_name').sort({ payment_date: -1 });
    } else if (type === 'defaulters') {
      data = await Payment.find({ payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: new Date() } }).populate('user_id', 'full_name mobile member_id').populate('chit_group_id', 'group_name').sort({ due_date: 1 });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${period}.json"`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ============ ANALYTICS / REPORTS ============
router.get('/analytics', adminOnly, async (req, res, next) => {
  try {
    const months = buildMonths(6);
    const [memberGrowth, monthlyCollections, kycStats, paymentStats] = await Promise.all([
      Promise.all(months.map(async m => {
        const count = await User.countDocuments({ role: 'member', created_at: { $gte: m.start, $lte: m.end } });
        return { month: m.label, count };
      })),
      getMonthlyCollections(months),
      User.aggregate([{ $match: { role: 'member' } }, { $group: { _id: '$kyc_status', count: { $sum: 1 } } }]),
      Payment.aggregate([{ $group: { _id: '$payment_status', count: { $sum: 1 }, total: { $sum: '$total_amount' } } }]),
    ]);
    res.json({ success: true, data: { memberGrowth, monthlyCollections, kycStats, paymentStats } });
  } catch (err) { next(err); }
});

router.get('/reports/collection', adminOnly, async (req, res, next) => {
  try {
    const { from_date, to_date, chit_group_id } = req.query;
    const filter = { payment_status: 'success' };
    if (from_date) filter.payment_date = { $gte: new Date(from_date) };
    if (to_date) filter.payment_date = { ...(filter.payment_date || {}), $lte: new Date(to_date + 'T23:59:59') };
    if (chit_group_id) filter.chit_group_id = chit_group_id;
    const payments = await Payment.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number')
      .sort({ payment_date: -1 });
    const totalAgg = await Payment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$total_amount' } } }]);
    res.json({ success: true, data: { payments, total: totalAgg[0]?.total || 0 } });
  } catch (err) { next(err); }
});

router.get('/reports/defaulters', adminOnly, async (req, res, next) => {
  try {
    const overduePayments = await Payment.find({ payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: new Date() } })
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number')
      .sort({ due_date: 1 });
    res.json({ success: true, data: overduePayments });
  } catch (err) { next(err); }
});

// ============ RISK ============
router.get('/risk/assessment', adminOnly, async (req, res, next) => {
  try {
    const [usersLowScore, defaulters, pendingKYC] = await Promise.all([
      User.find({ credit_score: { $lt: 600 }, role: 'member' }).select('full_name mobile credit_score').limit(20),
      Payment.aggregate([
        { $match: { payment_status: { $in: ['pending', 'overdue'] }, due_date: { $lt: new Date() } } },
        { $group: { _id: '$user_id', overdue_count: { $sum: 1 }, overdue_amount: { $sum: '$total_amount' } } },
        { $sort: { overdue_amount: -1 } },
        { $limit: 20 }
      ]),
      User.countDocuments({ kyc_status: 'pending', role: 'member' }),
    ]);
    res.json({ success: true, data: { lowCreditUsers: usersLowScore, topDefaulters: defaulters, pendingKYC } });
  } catch (err) { next(err); }
});

// ============ ERPNEXT INTEGRATION ============

// Check ERPNext config status
router.get('/erpnext/status', adminOnly, async (req, res) => {
  res.json({ success: true, data: { configured: erpnextService.isConfigured(), local_accounting: true } });
});

// Test connection
router.get('/erpnext/test', adminOnly, async (req, res, next) => {
  try {
    if (!erpnextService.isConfigured()) {
      return res.status(503).json({ success: false, message: 'ERPNext not configured. Add valid credentials in .env' });
    }
    const result = await erpnextService.testConnection();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Sync summary / dashboard
router.get('/erpnext/summary', adminOnly, async (req, res, next) => {
  try {
    if (!erpnextService.isConfigured()) {
      return res.status(503).json({ success: false, message: 'ERPNext not configured' });
    }
    const data = await erpnextService.getSyncSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Sync all members as Customers
router.post('/erpnext/sync/members', adminOnly, async (req, res, next) => {
  try {
    const members = await User.find({ role: 'member' }).lean();
    const result = await erpnextService.syncAllCustomers(members);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Sync all successful payments as Journal Entries
router.post('/erpnext/sync/payments', adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.body;
    const filter = { payment_status: 'success' };
    if (from || to) {
      filter.payment_date = {};
      if (from) filter.payment_date.$gte = new Date(from);
      if (to) filter.payment_date.$lte = new Date(to + 'T23:59:59');
    }
    const payments = await Payment.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number')
      .lean();
    const result = await erpnextService.syncAllPayments(payments);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Sync all chit groups as Projects
router.post('/erpnext/sync/groups', adminOnly, async (req, res, next) => {
  try {
    const groups = await ChitGroup.find().lean();
    const results = { synced: 0, failed: 0, errors: [] };
    for (const group of groups) {
      try {
        await erpnextService.syncChitGroup(group);
        results.synced++;
      } catch (err) {
        results.failed++;
        results.errors.push({ group: group.group_name, error: err.message });
      }
    }
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

// Fetch P&L from ERPNext
router.get('/erpnext/reports/pl', adminOnly, async (req, res, next) => {
  try {
    const data = await erpnextService.fetchProfitAndLoss(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Fetch Balance Sheet from ERPNext
router.get('/erpnext/reports/balance-sheet', adminOnly, async (req, res, next) => {
  try {
    const data = await erpnextService.fetchBalanceSheet(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Fetch General Ledger from ERPNext
router.get('/erpnext/reports/general-ledger', adminOnly, async (req, res, next) => {
  try {
    const data = await erpnextService.fetchGeneralLedger(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Fetch Trial Balance from ERPNext
router.get('/erpnext/reports/trial-balance', adminOnly, async (req, res, next) => {
  try {
    const data = await erpnextService.fetchTrialBalance(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Fetch Accounts Receivable
router.get('/erpnext/reports/receivable', adminOnly, async (req, res, next) => {
  try {
    const data = await erpnextService.fetchAccountsReceivable(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
