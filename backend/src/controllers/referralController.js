const { Referral, User } = require('../models');

exports.getMyReferrals = async (req, res, next) => {
  try {
    const referrals = await Referral.find({ referrer_id: req.user._id || req.user.id })
      .populate('referred_id', 'full_name mobile created_at')
      .sort({ created_at: -1 });
    res.json({ success: true, data: referrals });
  } catch (err) { next(err); }
};

exports.getMyReferralCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('referral_code');
    res.json({ success: true, data: { referral_code: user?.referral_code } });
  } catch (err) { next(err); }
};

exports.getReferralStats = async (req, res, next) => {
  try {
    const uid = req.user._id || req.user.id;
    const referrals = await Referral.find({ referrer_id: uid })
      .populate('referred_id', 'full_name mobile created_at')
      .sort({ created_at: -1 });
    const user = await User.findById(uid).select('referral_code');
    const successful = referrals.filter(r => r.status === 'credited').length;
    const total_earnings = referrals.filter(r => r.status === 'credited').reduce((s, r) => s + (r.bonus_amount || 0), 0);
    const pending_earnings = referrals.filter(r => r.status === 'pending').reduce((s, r) => s + (r.bonus_amount || 0), 0);
    res.json({
      success: true,
      data: {
        referral_code: user?.referral_code || 'N/A',
        totalReferrals: referrals.length,
        successfulReferrals: successful,
        total_earnings, pending_earnings,
        referrals: referrals.map(r => ({
          id: r._id, full_name: r.referred_id?.full_name || 'Unknown',
          created_at: r.created_at, reward_status: r.status,
        })),
      }
    });
  } catch (err) { next(err); }
};
