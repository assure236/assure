const { User, ChitGroup, ChitMember, Payment, Auction } = require('../models');
const AgentRequest = require('../models/AgentRequest');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { uploadToGridFS } = require('../utils/gridfs');
const { audit, getIp } = require('../utils/audit');
const { syncChitGroupStatuses } = require('../utils/chitGroupStatusSync');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    const userObj = user.toObject();

    // Show submitted values while waiting for admin approval.
    if (userObj.profile_edit_status === 'pending' && userObj.pending_profile_changes) {
      const previewFields = [
        'address',
        'date_of_birth',
        'city',
        'state',
        'pincode',
        'pan_number',
        'bank_account_number',
        'bank_ifsc_code',
        'bank_name',
        'gender',
        'nominee_name',
        'nominee_relationship',
        'current_address',
        'current_city',
        'current_state',
        'current_pincode',
      ];

      for (const field of previewFields) {
        if (userObj.pending_profile_changes[field] !== undefined) {
          userObj[field] = userObj.pending_profile_changes[field];
        }
      }
    }

    userObj.id = userObj._id;
    res.json({ success: true, data: userObj });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId).select('profile_edit_status full_name');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    const status = currentUser.profile_edit_status || 'none';
    if (['pending', 'approved'].includes(status)) {
      return res.status(403).json({
        success: false,
        message: status === 'pending'
          ? 'Your profile submission is already pending admin approval.'
          : 'Profile already approved. Contact support for further changes.',
      });
    }

    const allowedFields = [
      'address',
      'date_of_birth',
      'city',
      'state',
      'pincode',
      'pan_number',
      'bank_account_number',
      'bank_ifsc_code',
      'bank_name',
      'gender',
      'nominee_name',
      'nominee_relationship',
      'current_address',
      'current_city',
      'current_state',
      'current_pincode',
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No profile changes provided.' });
    }

    if (updates.pan_number) updates.pan_number = updates.pan_number.toUpperCase();
    if (updates.bank_ifsc_code) updates.bank_ifsc_code = updates.bank_ifsc_code.toUpperCase();

    if (updates.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(updates.pan_number)) {
      return res.status(400).json({ success: false, message: 'Invalid PAN format.' });
    }

    if (updates.bank_account_number && !/^\d{9,18}$/.test(String(updates.bank_account_number))) {
      return res.status(400).json({ success: false, message: 'Invalid bank account number format.' });
    }

    if (updates.bank_ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(updates.bank_ifsc_code)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        profile_edit_status: 'pending',
        pending_profile_changes: updates,
        profile_edit_requested_at: new Date(),
        profile_edit_rejection_reason: null,
        profile_edit_rejection_fields: [],
      },
      { new: true }
    ).select('-password_hash');

    const userObj = user.toObject();
    for (const [field, value] of Object.entries(updates)) {
      userObj[field] = value;
    }
    userObj.id = userObj._id;

    const { Notification } = require('../models');
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((admin) => ({
          user_id: admin._id,
          type: 'profile_edit_request',
          title: 'Profile Approval Needed',
          message: `${currentUser.full_name || 'Member'} submitted profile details for approval.`,
          metadata: { request_user_id: userId, changes: updates },
        }))
      );
    }

    res.json({
      success: true,
      message: 'Profile submitted successfully. Waiting for admin approval.',
      pending_approval: true,
      data: userObj,
    });

    audit({
      userId, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_requested',
      resourceType: 'user', resourceId: String(userId),
      description: 'Profile edit submitted for approval',
      metadata: { fields_updated: Object.keys(updates) },
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
      profile_edit_rejection_reason: null,
      profile_edit_rejection_fields: [],
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
    const { reason, rejection_fields } = req.body;
    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.profile_edit_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending edit request' });
    }

    const allowedRejectionFields = [
      'pan_number',
      'bank_account_number',
      'bank_ifsc_code',
      'bank_name',
      'address',
      'city',
      'state',
      'pincode',
      'date_of_birth',
      'gender',
      'nominee_name',
      'nominee_relationship',
      'current_address',
      'current_city',
      'current_state',
      'current_pincode',
    ];

    const rejectionFields = Array.isArray(rejection_fields)
      ? rejection_fields.filter((field) => allowedRejectionFields.includes(field))
      : [];

    await User.findByIdAndUpdate(user_id, {
      profile_edit_status: 'rejected',
      pending_profile_changes: null,
      profile_edit_reviewed_at: new Date(),
      profile_edit_reviewed_by: req.user._id || req.user.id,
      profile_edit_rejection_reason: reason || 'Rejected by admin',
      profile_edit_rejection_fields: rejectionFields,
    });

    // Notify user
    const { Notification } = require('../models');
    await Notification.create({
      user_id,
      type: 'profile_edit_rejected',
      title: 'Profile Changes Rejected',
      message: `Your profile changes were rejected. Reason: ${reason || 'See admin.'}`,
      metadata: { rejection_fields: rejectionFields },
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

exports.lookupIfsc = async (req, res, next) => {
  try {
    const ifsc = String(req.params.ifsc || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format.' });
    }

    const response = await axios.get(`https://ifsc.razorpay.com/${ifsc}`, {
      timeout: 8000,
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
      return res.status(404).json({ success: false, message: 'IFSC details not found.' });
    }

    const data = response.data;
    return res.json({
      success: true,
      data: {
        ifsc,
        bank: data.BANK || '',
        branch: data.BRANCH || '',
        address: data.ADDRESS || '',
        city: data.CITY || '',
        district: data.DISTRICT || '',
        state: data.STATE || '',
      },
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Unable to verify IFSC right now. Please try again.',
    });
  }
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
    await syncChitGroupStatuses();

    const memberships = await ChitMember.find({ user_id: req.user._id || req.user.id })
      .sort({ enrollment_date: -1, created_at: -1 })
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
