const { User, ChitGroup, ChitMember, Auction, Payment, Document } = require('../models');
const AppSetting = require('../models/AppSetting');
const { syncChitGroupStatuses } = require('../utils/chitGroupStatusSync');

exports.getMemberDashboard = async (req, res, next) => {
  try {
    await syncChitGroupStatuses();

    const userId = req.user._id || req.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [memberships, recentPayments, upcomingAuctions, user, showCreditScoreSetting] = await Promise.all([
      ChitMember.find({ user_id: userId, is_active: true })
        .sort({ enrollment_date: -1, created_at: -1 })
        .populate('chit_group_id'),
      Payment.find({ user_id: userId, payment_status: 'success' }).populate('chit_group_id', 'group_name').sort({ payment_date: -1 }).limit(5),
      Auction.find({ status: { $in: ['scheduled', 'in_progress', 'active'] } }).populate('chit_group_id', 'group_name group_number chit_value').sort({ auction_date: 1 }).limit(3),
      User.findById(userId).select('full_name credit_score kyc_status pan_number aadhaar_number digilocker_id profile_edit_status bank_ifsc_code bank_account_number'),
      AppSetting.findOne({ key: 'show_credit_score' }),
    ]);

    // Auto-sync kyc_status if docs are verified but status is stale
    if (user && user.kyc_status !== 'verified' && user.kyc_status !== 'rejected') {
      const docs = await Document.find({ user_id: userId });
      const panOk = !!user.pan_number || docs.some(d => d.document_type === 'pan_card' && ['verified', 'approved'].includes(d.verification_status));
      const aadhaarOk = !!user.aadhaar_number || docs.some(d => d.document_type === 'aadhaar_card' && ['verified', 'approved'].includes(d.verification_status));
      if (panOk && aadhaarOk && !!user.digilocker_id) {
        await User.findByIdAndUpdate(userId, { kyc_status: 'verified', kyc_verified_at: new Date() });
        user.kyc_status = 'verified';
      }
    }

    const [paidThisMonth, totalInvestedAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { user_id: userId, payment_status: 'success', payment_date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { user_id: userId, payment_status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
    ]);

    const totalInvested = totalInvestedAgg[0]?.total || 0;

    // Compute actual total_paid and months_paid per group from Payment records
    const groupIds = memberships.map(m => m.chit_group_id?._id).filter(Boolean);
    const [perGroupPayments, completedAuctionCounts] = await Promise.all([
      groupIds.length > 0 ? Payment.aggregate([
        { $match: { user_id: userId, payment_status: 'success', chit_group_id: { $in: groupIds } } },
        { $group: { _id: '$chit_group_id', total_paid: { $sum: '$amount' }, months_paid: { $sum: 1 } } }
      ]) : [],
      groupIds.length > 0 ? Auction.aggregate([
        { $match: { chit_group_id: { $in: groupIds }, status: 'completed' } },
        { $group: { _id: '$chit_group_id', count: { $sum: 1 } } }
      ]) : [],
    ]);
    const paymentMap = {};
    for (const pg of perGroupPayments) {
      paymentMap[pg._id.toString()] = { total_paid: pg.total_paid, months_paid: pg.months_paid };
    }
    const currentMonthMap = {};
    for (const a of completedAuctionCounts) {
      currentMonthMap[a._id.toString()] = a.count;
    }

    // Enrich memberships with real payment data and current_month (completed auctions count)
    const enrichedMemberships = memberships.map(m => {
      const obj = m.toObject();
      const gid = m.chit_group_id?._id?.toString();
      const stats = gid ? paymentMap[gid] : null;
      obj.total_paid = stats?.total_paid || obj.total_paid_amount || 0;
      obj.months_paid = stats?.months_paid || 0;
      // Inject current_month since ChitGroup schema doesn't store it
      if (obj.chit_group_id && gid) {
        obj.chit_group_id.current_month = currentMonthMap[gid] || 0;
      }
      return obj;
    });

    res.json({
      success: true,
      data: {
        user,
        totalGroups: memberships.length,
        activeGroups: memberships.filter(m => m.chit_group_id?.status === 'active').length,
        totalInvested,
        paymentsThisMonth: paidThisMonth[0]?.total || 0,
        showCreditScore: showCreditScoreSetting?.value === 'true' || showCreditScoreSetting?.value === true,
        memberships: enrichedMemberships,
        recentPayments,
        upcomingAuctions: upcomingAuctions.map(a => ({ ...a.toObject(), status: a.status === 'in_progress' ? 'active' : a.status })),
      }
    });
  } catch (err) { next(err); }
};

exports.getMemberAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) });
    }

    const [paid, pending, failed, memberships] = await Promise.all([
      Payment.countDocuments({ user_id: userId, payment_status: 'success' }),
      Payment.countDocuments({ user_id: userId, payment_status: 'pending' }),
      Payment.countDocuments({ user_id: userId, payment_status: 'failed' }),
      ChitMember.find({ user_id: userId, is_active: true }).populate('chit_group_id', 'group_name chit_value status'),
    ]);

    const monthlyPayments = await Promise.all(months.map(async m => {
      const r = await Payment.aggregate([
        { $match: { user_id: userId, payment_status: 'success', payment_date: { $gte: m.start, $lte: m.end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return r[0]?.total || 0;
    }));

    const totalInvestedAgg = await Payment.aggregate([
      { $match: { user_id: userId, payment_status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: {
        monthly_collections: months.map((m, i) => ({ month: m.label, amount: monthlyPayments[i] })),
        payment_status: { paid, pending, failed },
        active_chits: memberships.length,
        chit_details: memberships.map(m => ({ group_name: m.chit_group_id?.group_name, chit_value: m.chit_group_id?.chit_value, status: m.chit_group_id?.status })),
        total_invested: totalInvestedAgg[0]?.total || 0,
      }
    });
  } catch (err) { next(err); }
};

exports.getDividendAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const memberships = await ChitMember.find({ user_id: userId, is_active: true }).populate('chit_group_id');
    const groupIds = memberships.map(m => m.chit_group_id?._id).filter(Boolean);
    const completedAuctions = groupIds.length > 0
      ? await Auction.find({ chit_group_id: { $in: groupIds }, status: 'completed' }).populate('chit_group_id')
      : [];

    // Build per-group analytics the frontend expects
    const groups = memberships.map(m => {
      const g = m.chit_group_id;
      if (!g) return null;
      const groupAuctions = completedAuctions.filter(a => a.chit_group_id?._id?.toString() === g._id.toString());
      const totalMembers = g.total_members || 1;
      const chitValue = g.chit_value || 0;
      const commission = chitValue * 0.05;
      const avgWinBid = groupAuctions.length > 0
        ? groupAuctions.reduce((s, a) => s + (a.winning_bid_amount || 0), 0) / groupAuctions.length
        : chitValue * 0.25;
      const avgDividend = avgWinBid / totalMembers;
      const netReturn = avgDividend * (g.duration_months || 0);
      const effectiveReturnPct = chitValue > 0 ? ((netReturn / chitValue) * 100).toFixed(1) : '0.0';
      const winProbability = totalMembers > 0 ? ((1 / totalMembers) * 100).toFixed(1) : '0.0';

      // Projected monthly dividends for remaining duration
      const remainingMonths = Math.max(0, (g.duration_months || 0) - groupAuctions.length);
      const projected_dividends = Array.from({ length: remainingMonths }, (_, i) => ({
        month: groupAuctions.length + i + 1,
        estimated_dividend: Math.round(avgDividend),
        cumulative: Math.round(avgDividend * (i + 1)),
      }));

      return {
        group_id: g._id.toString(),
        group_name: g.group_name,
        current_month: groupAuctions.length,
        duration_months: g.duration_months || 0,
        chit_value: chitValue,
        monthly_installment: g.monthly_installment || chitValue / totalMembers,
        avg_dividend_per_member: Math.round(avgDividend),
        net_return: Math.round(netReturn),
        avg_winning_bid: Math.round(avgWinBid),
        effective_return_pct: parseFloat(effectiveReturnPct),
        completed_auctions: groupAuctions.length,
        win_probability_pct: parseFloat(winProbability),
        projected_dividends,
      };
    }).filter(Boolean);

    res.json({ success: true, data: { groups, memberships, completedAuctions } });
  } catch (err) { next(err); }
};

exports.getProfileCompletion = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('full_name email mobile pan_number aadhaar_number date_of_birth address city state pincode profile_image_url bank_account_number bank_ifsc_code kyc_status profile_edit_status');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const fields = [
      { key: 'full_name', label: 'Full Name', filled: !!user.full_name },
      { key: 'email', label: 'Email', filled: !!user.email },
      { key: 'mobile', label: 'Mobile', filled: !!user.mobile },
      { key: 'pan_number', label: 'PAN Number', filled: !!user.pan_number },
      { key: 'aadhaar_number', label: 'Aadhaar Number', filled: !!user.aadhaar_number },
      { key: 'date_of_birth', label: 'Date of Birth', filled: !!user.date_of_birth },
      { key: 'address', label: 'Address', filled: !!user.address },
      { key: 'city', label: 'City', filled: !!user.city },
      { key: 'state', label: 'State', filled: !!user.state },
      { key: 'pincode', label: 'Pincode', filled: !!user.pincode },
      { key: 'profile_image_url', label: 'Profile Photo', filled: !!user.profile_image_url },
      { key: 'bank_account_number', label: 'Bank Account', filled: !!user.bank_account_number },
      { key: 'bank_ifsc_code', label: 'Bank IFSC', filled: !!user.bank_ifsc_code },
    ];

    const filled = fields.filter(f => f.filled).length;
    const total = fields.length;
    const rawPercentage = Math.round((filled / total) * 100);
    const isApproved = (user.profile_edit_status || '').toString().toLowerCase() === 'approved';
    const percentage = isApproved ? 100 : rawPercentage;

    res.json({
      success: true,
      data: {
        percentage,
        filled: isApproved ? total : filled,
        total,
        fields,
        isComplete: isApproved || percentage === 100,
      }
    });
  } catch (err) { next(err); }
};

exports.getAdminDashboard = async (req, res, next) => {
  try {
    const [totalUsers, totalGroups, activeAuctions] = await Promise.all([
      User.countDocuments({ role: 'member' }),
      ChitGroup.countDocuments(),
      Auction.countDocuments({ status: { $in: ['scheduled', 'in_progress'] } }),
    ]);
    const totalPaymentsAgg = await Payment.aggregate([{ $match: { payment_status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ success: true, data: { totalUsers, totalGroups, totalPayments: totalPaymentsAgg[0]?.total || 0, activeAuctions } });
  } catch (err) { next(err); }
};

exports.getStatistics = async (req, res, next) => {
  try {
    const [users, groups, auctions] = await Promise.all([
      User.countDocuments(), ChitGroup.countDocuments(), Auction.countDocuments({ status: 'completed' })
    ]);
    const rev = await Payment.aggregate([{ $match: { payment_status: 'success' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]);
    res.json({ success: true, data: { users, groups, totalRevenue: rev[0]?.t || 0, completedAuctions: auctions } });
  } catch (err) { next(err); }
};
