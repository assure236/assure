const { FamilyMember, User, Notification } = require('../models');
const { sendOTP } = require('../services/notificationService');

const familyOtpStore = new Map();
const FAMILY_OTP_TTL_MS = 10 * 60 * 1000;

function storeFamilyOtp(key, otp) {
  familyOtpStore.set(key, { otp: String(otp), exp: Date.now() + FAMILY_OTP_TTL_MS });
}

function verifyFamilyOtp(key, otp) {
  const item = familyOtpStore.get(key);
  if (!item || Date.now() > item.exp) {
    familyOtpStore.delete(key);
    return false;
  }
  if (item.otp !== String(otp || '').trim()) {
    return false;
  }
  familyOtpStore.delete(key);
  return true;
}

// GET /api/v1/users/family-members
exports.list = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const members = await FamilyMember.find({ user_id: userId, is_active: true })
      .sort({ created_at: -1 });
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};

// POST /api/v1/users/family-members
exports.create = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const memberId = String(req.body.member_id || '').trim().toUpperCase();
    const otp = String(req.body.otp || '').trim();

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member ID is required' });
    }

    const targetUser = await User.findOne({ member_id: memberId, is_active: true })
      .select('_id full_name mobile email member_id');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Member ID not found' });
    }
    if (String(targetUser._id) === String(userId)) {
      return res.status(400).json({ success: false, message: 'You cannot link your own Member ID here' });
    }

    const existing = await FamilyMember.findOne({
      user_id: userId,
      linked_user_id: targetUser._id,
      is_active: true,
      status: { $in: ['pending', 'approved', 'linked'] },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This member is already linked or awaiting approval' });
    }

    const otpKey = `${userId}:${targetUser._id}`;
    if (!otp) {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      storeFamilyOtp(otpKey, generatedOtp);
      try {
        await sendOTP(targetUser.mobile, generatedOtp);
      } catch (_) {
        return res.status(503).json({ success: false, message: 'Unable to send OTP right now. Please try again.' });
      }

      return res.json({
        success: true,
        requires_otp: true,
        message: 'OTP sent to linked member mobile for verification',
        data: {
          member_id: targetUser.member_id,
          masked_mobile: targetUser.mobile ? `******${String(targetUser.mobile).slice(-4)}` : null,
        },
      });
    }

    if (!verifyFamilyOtp(otpKey, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const count = await FamilyMember.countDocuments({ user_id: userId, is_active: true });
    if (count >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 family members allowed' });
    }

    const member = await FamilyMember.create({
      user_id: userId,
      member_id: targetUser.member_id,
      full_name: targetUser.full_name,
      relationship: 'other',
      mobile: targetUser.mobile,
      email: targetUser.email,
      linked_user_id: targetUser._id,
      is_nominee: false,
      status: 'pending',
    });

    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map((admin) => ({
          user_id: admin._id,
          type: 'family_member_link_request',
          title: 'Family Member Link Approval Needed',
          message: `${req.user.full_name || 'A member'} requested to link Member ID ${targetUser.member_id}.`,
          data: { owner_user_id: String(userId), family_member_id: String(member._id), member_id: targetUser.member_id },
        })));
      }
    } catch (_) {}

    res.status(201).json({ success: true, message: 'Family member request submitted for admin approval', data: member });
  } catch (err) { next(err); }
};

// PUT /api/v1/users/family-members/:id
exports.update = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { is_nominee } = req.body;

    const member = await FamilyMember.findOne({ _id: req.params.id, user_id: userId, is_active: true });
    if (!member) return res.status(404).json({ success: false, message: 'Family member not found' });

    if (member.status === 'pending') {
      return res.status(400).json({ success: false, message: 'This member is pending admin approval and cannot be edited' });
    }

    if (is_nominee) {
      await FamilyMember.updateMany({ user_id: userId, _id: { $ne: member._id } }, { is_nominee: false });
    }

    Object.assign(member, {
      ...(is_nominee !== undefined && { is_nominee }),
    });
    await member.save();

    res.json({ success: true, message: 'Family member updated', data: member });
  } catch (err) { next(err); }
};

// DELETE /api/v1/users/family-members/:id
exports.remove = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const member = await FamilyMember.findOneAndUpdate(
      { _id: req.params.id, user_id: userId, is_active: true },
      { is_active: false },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Family member not found' });
    res.json({ success: true, message: 'Family member removed' });
  } catch (err) { next(err); }
};

// ADMIN: GET /api/v1/admin/users/:id/family-members
exports.adminList = async (req, res, next) => {
  try {
    const members = await FamilyMember.find({ user_id: req.params.id, is_active: true })
      .sort({ created_at: -1 });
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};
