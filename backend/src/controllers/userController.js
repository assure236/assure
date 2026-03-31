const { User, ChitGroup, ChitMember, Payment } = require('../models');
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
const s3 = USE_S3 ? new AWS.S3({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }) : null;
const BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/profiles');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, email, address, date_of_birth, city, state, pincode, pan_number, bank_account_number, bank_ifsc_code } = req.body;
    const update = { full_name, email, address, date_of_birth, city, state, pincode };
    // Only set optional fields if provided
    if (pan_number !== undefined) update.pan_number = pan_number;
    if (bank_account_number !== undefined) update.bank_account_number = bank_account_number;
    if (bank_ifsc_code !== undefined) update.bank_ifsc_code = bank_ifsc_code;
    const user = await User.findByIdAndUpdate(
      req.user._id || req.user.id,
      update,
      { new: true }
    ).select('-password_hash');
    res.json({ success: true, message: 'Profile updated', data: user });
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
    const ext = path.extname(req.file.originalname);
    const fileName = uuidv4() + ext;
    let fileUrl;

    if (USE_S3) {
      const s3Key = 'profiles/' + userId + '/' + fileName;
      await s3.upload({ Bucket: BUCKET, Key: s3Key, Body: req.file.buffer, ContentType: req.file.mimetype, ServerSideEncryption: 'AES256' }).promise();
      fileUrl = CLOUDFRONT_URL ? CLOUDFRONT_URL + '/' + s3Key : 'https://' + BUCKET + '.s3.' + process.env.AWS_REGION + '.amazonaws.com/' + s3Key;
    } else {
      if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileName), req.file.buffer);
      const baseUrl = process.env.BACKEND_URL || ('http://localhost:' + (process.env.PORT || 5000));
      fileUrl = baseUrl + '/uploads/profiles/' + fileName;
    }

    const user = await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl }, { new: true }).select('-password_hash');
    res.json({ success: true, message: 'Profile image uploaded', data: user });
  } catch (err) { next(err); }
};

exports.getMyChitGroups = async (req, res, next) => {
  try {
    const memberships = await ChitMember.find({ user_id: req.user._id || req.user.id })
      .populate('chit_group_id');
    res.json({ success: true, data: memberships });
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
