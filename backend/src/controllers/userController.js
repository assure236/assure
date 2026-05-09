const { User, ChitGroup, ChitMember, Payment, Auction } = require('../models');
const AgentRequest = require('../models/AgentRequest');
const bcrypt = require('bcrypt');
const { uploadToGridFS } = require('../utils/gridfs');
const { audit, getIp } = require('../utils/audit');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    const userObj = user.toObject();
    userObj.id = userObj._id;
    res.json({ success: true, data: userObj });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { full_name, email, address, date_of_birth, city, state, pincode, pan_number, bank_account_number, bank_ifsc_code, bank_name, gender, nominee_name, nominee_relationship, current_address, current_city, current_state, current_pincode } = req.body;

    // Sensitive fields that require admin approval
    const sensitiveFields = ['pan_number', 'bank_account_number', 'bank_ifsc_code', 'bank_name', 'email', 'full_name'];
    const allFields = { full_name, email, address, date_of_birth, city, state, pincode, pan_number, bank_account_number, bank_ifsc_code, bank_name, gender, nominee_name, nominee_relationship, current_address, current_city, current_state, current_pincode };
    
    // Separate sensitive from non-sensitive
    const sensitiveChanges = {};
    const directUpdate = {};
    for (const [key, value] of Object.entries(allFields)) {
      if (value === undefined) continue;
      if (sensitiveFields.includes(key)) {
        sensitiveChanges[key] = value;
      } else {
        directUpdate[key] = value;
      }
    }

    // Apply non-sensitive changes directly
    if (Object.keys(directUpdate).length > 0) {
      await User.findByIdAndUpdate(userId, directUpdate);
    }

    // If sensitive changes, create approval request
    if (Object.keys(sensitiveChanges).length > 0) {
      await User.findByIdAndUpdate(userId, {
        profile_edit_status: 'pending',
        pending_profile_changes: sensitiveChanges,
        profile_edit_requested_at: new Date(),
        profile_edit_rejection_reason: null,
      });

      // Notify admins
      const { Notification } = require('../models');
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      const adminNotifications = admins.map(admin => ({
        user_id: admin._id,
        type: 'profile_edit_request',
        title: 'Profile Edit Request',
        message: `${req.user.full_name} requested changes to: ${Object.keys(sensitiveChanges).join(', ')}`,
        metadata: { request_user_id: userId, changes: sensitiveChanges },
      }));
      if (adminNotifications.length > 0) await Notification.insertMany(adminNotifications);
    }

    const user = await User.findById(userId).select('-password_hash');
    const hasPending = Object.keys(sensitiveChanges).length > 0;

    res.json({
      success: true,
      message: hasPending
        ? 'Non-sensitive fields updated. Sensitive changes require admin approval.'
        : 'Profile updated',
      data: user,
      pending_approval: hasPending,
    });

    audit({
      userId, userName: req.user.full_name, userRole: req.user.role,
      action: hasPending ? 'profile_edit_requested' : 'profile_updated',
      resourceType: 'user', resourceId: String(userId),
      description: hasPending ? 'Profile edit request submitted for approval' : 'Profile updated',
      metadata: { fields_updated: Object.keys(directUpdate), pending_fields: Object.keys(sensitiveChanges) },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

// Admin: Approve profile edit
exports.approveProfileEdit = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.profile_edit_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending edit request' });
    }

    const changes = targetUser.pending_profile_changes || {};
    await User.findByIdAndUpdate(user_id, {
      ...changes,
      profile_edit_status: 'approved',
      pending_profile_changes: null,
      profile_edit_reviewed_at: new Date(),
      profile_edit_reviewed_by: req.user._id || req.user.id,
    });

    // Notify user
    const { Notification } = require('../models');
    await Notification.create({
      user_id,
      type: 'profile_edit_approved',
      title: 'Profile Changes Approved',
      message: 'Your profile changes have been approved and applied.',
    });

    const user = await User.findById(user_id).select('-password_hash');
    res.json({ success: true, message: 'Profile edit approved', data: user });

    audit({
      userId: req.user._id || req.user.id, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_approved', resourceType: 'user', resourceId: String(user_id),
      description: `Approved profile edit for ${targetUser.full_name}`,
      metadata: { approved_fields: Object.keys(changes) },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

// Admin: Reject profile edit
exports.rejectProfileEdit = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { reason } = req.body;
    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.profile_edit_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending edit request' });
    }

    await User.findByIdAndUpdate(user_id, {
      profile_edit_status: 'rejected',
      pending_profile_changes: null,
      profile_edit_reviewed_at: new Date(),
      profile_edit_reviewed_by: req.user._id || req.user.id,
      profile_edit_rejection_reason: reason || 'Rejected by admin',
    });

    // Notify user
    const { Notification } = require('../models');
    await Notification.create({
      user_id,
      type: 'profile_edit_rejected',
      title: 'Profile Changes Rejected',
      message: `Your profile changes were rejected. Reason: ${reason || 'See admin.'}`,
    });

    res.json({ success: true, message: 'Profile edit rejected' });

    audit({
      userId: req.user._id || req.user.id, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_rejected', resourceType: 'user', resourceId: String(user_id),
      description: `Rejected profile edit for ${targetUser.full_name}: ${reason || 'No reason'}`,
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const currentPassword = req.body.currentPassword || req.body.current_password;
    const newPassword = req.body.newPassword || req.body.new_password;
    const user = await User.findById(req.user._id || req.user.id);
    const valid = await user.validatePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password_hash = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const userId = req.user._id || req.user.id;

    const { fileUrl } = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype, {
      userId: userId.toString(), category: 'profiles',
    });

    const user = await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl }, { new: true }).select('-password_hash');
    const userObj = user.toObject();
    userObj.id = userObj._id;
    res.json({ success: true, message: 'Profile image uploaded', data: userObj });
  } catch (err) { next(err); }
};

exports.getMyChitGroups = async (req, res, next) => {
  try {
    const memberships = await ChitMember.find({ user_id: req.user._id || req.user.id })
      .populate('chit_group_id');

    // Compute current_month from completed auction count for accurate months tracking
    const enriched = await Promise.all(memberships.map(async (m) => {
      const obj = m.toObject();
      if (obj.chit_group_id && obj.chit_group_id._id) {
        const completedCount = await Auction.countDocuments({
          chit_group_id: obj.chit_group_id._id,
          status: 'completed',
        });
        obj.chit_group_id.current_month = completedCount;
      }
      return obj;
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

exports.getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user_id: req.user._id || req.user.id })
      .sort({ created_at: -1 });
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
};

exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcm_token } = req.body;
    await User.findByIdAndUpdate(req.user._id || req.user.id, { fcm_token });
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) { next(err); }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, kyc_status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (kyc_status) filter.kyc_status = kyc_status;
    const total = await User.countDocuments(filter);
    const rows = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ── Agent Request ──
exports.submitAgentRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const existing = await AgentRequest.findOne({ user_id: userId, status: 'pending' });
    if (existing) return res.status(400).json({ success: false, message: 'You already have a pending agent request' });
    const user = await User.findById(userId);
    if (user.role === 'agent') return res.status(400).json({ success: false, message: 'You are already an agent' });
    const request = await AgentRequest.create({ user_id: userId });
    res.json({ success: true, data: request, message: 'Agent request submitted successfully' });
  } catch (err) { next(err); }
};

exports.getMyAgentRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const request = await AgentRequest.findOne({ user_id: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

// ── Admin: Agent Requests ──
exports.getAgentRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const total = await AgentRequest.countDocuments(filter);
    const rows = await AgentRequest.find(filter)
      .populate('user_id', 'full_name phone email member_id profile_image_url')
      .populate('reviewed_by', 'full_name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.reviewAgentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }
    const request = await AgentRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already reviewed' });
    request.status = status;
    request.admin_note = admin_note;
    request.reviewed_by = req.user._id || req.user.id;
    request.reviewed_at = new Date();
    await request.save();
    if (status === 'approved') {
      await User.findByIdAndUpdate(request.user_id, { role: 'agent' });
    }
    res.json({ success: true, data: request, message: `Agent request ${status}` });
  } catch (err) { next(err); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { full_name, email, mobile, role, is_active, kyc_status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { full_name, email, mobile, role, is_active, kyc_status },
      { new: true }
    ).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User updated', data: user });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
};
