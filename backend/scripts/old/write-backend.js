// Run: node write-backend.js
// Writes all updated backend files for MongoDB migration
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const write = (rel, content) => {
  const full = path.join(srcDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('✓', rel);
};

// ─── models/index.js ─────────────────────────────────────────────────────────
write('models/index.js', `const { mongoose } = require('../config/database');
const User = require('./User');
const ChitGroup = require('./ChitGroup');
const ChitMember = require('./ChitMember');
const Auction = require('./Auction');
const Bid = require('./Bid');
const Payment = require('./Payment');
const Document = require('./Document');
const Referral = require('./Referral');
const Notification = require('./Notification');
const AppSetting = require('./AppSetting');
const Branch = require('./Branch');
const CommunicationLog = require('./CommunicationLog');
const SupportTicket = require('./SupportTicket');

module.exports = {
  mongoose,
  User, ChitGroup, ChitMember, Auction, Bid, Payment,
  Document, Referral, Notification, AppSetting, Branch,
  CommunicationLog, SupportTicket,
};
`);

// ─── server.js ───────────────────────────────────────────────────────────────
write('server.js', `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const socketHandler = require('./sockets/socketHandler');

require('./cron/reminders');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL], credentials: true }
});

app.use(helmet());
app.use(cors({ origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL], credentials: true }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => process.env.NODE_ENV === 'development'
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

const pathModule = require('path');
app.use('/uploads', express.static(pathModule.join(__dirname, '../uploads')));
app.use('/api/' + process.env.API_VERSION, routes);

socketHandler(io);
app.set('io', io);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  server.listen(PORT, () => {
    logger.info('Server running on port ' + PORT + ' in ' + process.env.NODE_ENV + ' mode');
    logger.info('API at http://localhost:' + PORT + '/api/' + process.env.API_VERSION);
  });
  try {
    await connectDB();
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    logger.warn('Set MONGO_URI in backend/.env to enable database features');
  }
};

process.on('SIGTERM', () => {
  server.close(() => { process.exit(0); });
});

startServer();
`);

// ─── middleware/auth.js ───────────────────────────────────────────────────────
write('middleware/auth.js', `const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer dev-bypass-token') {
        req.user = {
          id: '000000000000000000000001',
          _id: '000000000000000000000001',
          full_name: 'Dev User',
          email: 'dev@assure.local',
          mobile: '9999999999',
          role: 'admin',
          is_active: true,
          kyc_status: 'verified',
        };
        return next();
      }
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password_hash');
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated.' });

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired.' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
};

module.exports = { authMiddleware, authorizeRoles };
`);

// ─── controllers/authController.js ───────────────────────────────────────────
write('controllers/authController.js', `const { User, Referral } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const { sendOTP, sendEmail } = require('../services/notificationService');

const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;

function genOtp() { return Math.floor(100000 + Math.random() * 900000).toString(); }

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

const generateRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

exports.resendOtp = async (req, res, next) => {
  try {
    const { mobile, email, type } = req.body;
    if (type === 'email' && email) {
      const otp = genOtp();
      otpStore.set('email:' + email, { otp, expires: Date.now() + OTP_TTL_MS, verified: false });
      await sendEmail(email, 'Your Assure ChitFunds OTP',
        '<p>Your OTP is: <b style="font-size:20px">' + otp + '</b>.</p><p>Valid for 10 minutes.</p>');
      const response = { success: true, message: 'OTP sent to ' + email };
      if (process.env.NODE_ENV !== 'production') response.otp = otp;
      return res.json(response);
    }
    if (mobile) {
      const otp = genOtp();
      otpStore.set('mobile:' + mobile, { otp, expires: Date.now() + OTP_TTL_MS, verified: false });
      await sendOTP(mobile, otp);
      const response = { success: true, message: 'OTP sent to +91 ' + mobile };
      if (process.env.NODE_ENV !== 'production') response.otp = otp;
      return res.json(response);
    }
    return res.status(400).json({ success: false, message: 'Provide mobile or email' });
  } catch (error) { next(error); }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { mobile, email, otp, type } = req.body;
    const resolvedType = type || 'mobile';
    const target = resolvedType === 'email' ? email : mobile;
    if (!target || !otp) return res.status(400).json({ success: false, message: 'target and otp are required' });
    const key = resolvedType + ':' + target;
    const record = otpStore.get(key);
    if (!record) return res.status(400).json({ success: false, message: 'OTP not sent or already used.' });
    if (Date.now() > record.expires) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP expired.' });
    }
    if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    record.verified = true;
    return res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) { next(error); }
};

exports.register = async (req, res, next) => {
  try {
    const { full_name, email, mobile, mpin, referral_code } = req.body;
    const mobileRecord = otpStore.get('mobile:' + mobile);
    const emailRecord = otpStore.get('email:' + email);
    if (!mobileRecord || !mobileRecord.verified) return res.status(400).json({ success: false, message: 'Mobile OTP not verified' });
    if (!emailRecord || !emailRecord.verified) return res.status(400).json({ success: false, message: 'Email OTP not verified' });

    if (await User.findOne({ mobile })) return res.status(400).json({ success: false, message: 'Mobile already registered' });
    if (await User.findOne({ email })) return res.status(400).json({ success: false, message: 'Email already registered' });

    let referred_by = null;
    if (referral_code) {
      const referrer = await User.findOne({ referral_code });
      if (referrer) referred_by = referrer._id;
    }

    const user = new User({ full_name, email, mobile, password_hash: mpin, referred_by, role: 'member' });
    await user.save();

    if (referred_by) {
      const referrer = await User.findById(referred_by);
      await Referral.create({ referrer_id: referred_by, referred_id: user._id, referral_code_used: referral_code });
    }

    otpStore.delete('mobile:' + mobile);
    otpStore.delete('email:' + email);

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token, refreshToken,
        user: { id: user._id, full_name: user.full_name, email: user.email, mobile: user.mobile, role: user.role, kyc_status: user.kyc_status, member_id: user.member_id }
      }
    });
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { mobile, mpin, email, password } = req.body;
    const identifier = mobile || email;
    if (!identifier) return res.status(400).json({ success: false, message: 'Mobile or email required' });

    const user = await User.findOne(mobile ? { mobile } : { email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

    const pin = mpin || password;
    const valid = await user.validatePassword(pin);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    user.last_login_at = new Date();
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      data: {
        token, refreshToken,
        user: { id: user._id, full_name: user.full_name, email: user.email, mobile: user.mobile, role: user.role, kyc_status: user.kyc_status, member_id: user.member_id }
      }
    });
  } catch (error) { next(error); }
};

exports.adminLogin = exports.login;

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password_hash');
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    const token = generateToken(user._id);
    res.json({ success: true, data: { token } });
  } catch (error) { next(error); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ success: false, message: 'Mobile required' });
    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const otp = genOtp();
    otpStore.set('mobile:' + mobile, { otp, expires: Date.now() + OTP_TTL_MS, verified: false });
    await sendOTP(mobile, otp);
    const response = { success: true, message: 'OTP sent for password reset' };
    if (process.env.NODE_ENV !== 'production') response.otp = otp;
    res.json(response);
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, new_mpin } = req.body;
    const record = otpStore.get('mobile:' + mobile);
    if (!record || !record.verified || record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or unverified OTP' });
    }
    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password_hash = new_mpin;
    await user.save();
    otpStore.delete('mobile:' + mobile);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) { next(error); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id || req.user.id);
    const valid = await user.validatePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password_hash = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (error) { next(error); }
};

exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { ...user.toObject(), id: user._id } });
  } catch (error) { next(error); }
};
`);

// ─── controllers/userController.js ───────────────────────────────────────────
write('controllers/userController.js', `const { User, ChitGroup, ChitMember, Payment } = require('../models');
const bcrypt = require('bcrypt');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, email, address, date_of_birth, city, state, pincode } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id || req.user.id,
      { full_name, email, address, date_of_birth, city, state, pincode },
      { new: true }
    ).select('-password_hash');
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id || req.user.id);
    const valid = await user.validatePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password_hash = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

exports.uploadProfileImage = async (req, res, next) => {
  res.json({ success: true, message: 'Profile image upload pending', data: null });
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
`);

// ─── controllers/notificationController.js ───────────────────────────────────
write('controllers/notificationController.js', `const { Notification } = require('../models');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const filter = { user_id: req.user._id || req.user.id };
    if (unread === 'true') filter.is_read = false;
    const total = await Notification.countDocuments(filter);
    const rows = await Notification.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, data: { notifications: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id || req.user.id },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) { next(err); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user_id: req.user._id || req.user.id, is_read: false },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user._id || req.user.id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
};
`);

// ─── controllers/referralController.js ───────────────────────────────────────
write('controllers/referralController.js', `const { Referral, User } = require('../models');

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
`);

// ─── controllers/dashboardController.js ──────────────────────────────────────
write('controllers/dashboardController.js', `const { User, ChitGroup, ChitMember, Auction, Payment } = require('../models');

exports.getMemberDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [memberships, recentPayments, upcomingAuctions, user] = await Promise.all([
      ChitMember.find({ user_id: userId, is_active: true }).populate('chit_group_id'),
      Payment.find({ user_id: userId, payment_status: 'success' }).sort({ payment_date: -1 }).limit(5),
      Auction.find({ status: { $in: ['scheduled', 'in_progress'] } }).sort({ auction_date: 1 }).limit(3),
      User.findById(userId).select('full_name credit_score kyc_status'),
    ]);

    const paidThisMonth = await Payment.aggregate([
      { $match: { user_id: require('mongoose').Types.ObjectId.isValid(userId) ? require('mongoose').Types.ObjectId(userId) : userId, payment_status: 'success', payment_date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalInvested = recentPayments.reduce((s, p) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        user,
        totalGroups: memberships.length,
        activeGroups: memberships.filter(m => m.chit_group_id?.status === 'active').length,
        totalInvested,
        paymentsThisMonth: paidThisMonth[0]?.total || 0,
        memberships,
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
        { $match: { user_id: require('mongoose').Types.ObjectId.isValid(userId) ? require('mongoose').Types.ObjectId(userId) : userId, payment_status: 'success', payment_date: { $gte: m.start, $lte: m.end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return r[0]?.total || 0;
    }));

    const totalInvestedAgg = await Payment.aggregate([
      { $match: { user_id: require('mongoose').Types.ObjectId.isValid(userId) ? require('mongoose').Types.ObjectId(userId) : userId, payment_status: 'success' } },
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
    res.json({ success: true, data: { memberships, completedAuctions } });
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
`);

// ─── controllers/chitGroupController.js ──────────────────────────────────────
write('controllers/chitGroupController.js', `const { ChitGroup, ChitMember, User, Auction, Payment } = require('../models');

exports.getAllChitGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    else if (req.user.role === 'member') filter.status = 'active';
    const total = await ChitGroup.countDocuments(filter);
    const groups = await ChitGroup.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, data: { groups, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
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
    res.json({ success: true, data: { ...group.toObject(), members, auctions } });
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
    const now = new Date();
    const start = group.commencement_date ? new Date(group.commencement_date) : now;
    const schedule = [];
    for (let i = 1; i <= group.duration_months; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      schedule.push({ month_number: i, due_date: dueDate.toISOString().split('T')[0], amount: group.monthly_installment, status: paidMonths.has(i) ? 'paid' : dueDate < now ? 'overdue' : 'pending' });
    }
    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
};
`);

// ─── controllers/auctionController.js ────────────────────────────────────────
write('controllers/auctionController.js', `const { Auction, Bid, ChitGroup, ChitMember, User } = require('../models');

const normalizeStatus = (s) => s === 'in_progress' ? 'active' : s;

exports.getUpcomingAuctions = async (req, res, next) => {
  try {
    const auctions = await Auction.find({ status: { $in: ['scheduled', 'in_progress'] } })
      .populate('chit_group_id', 'group_name chit_value')
      .sort({ auction_date: 1 })
      .limit(10);
    res.json({ success: true, data: auctions });
  } catch (err) { next(err); }
};

exports.getMyAuctions = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const memberships = await ChitMember.find({ user_id: userId, is_active: true }).select('chit_group_id');
    const groupIds = memberships.map(m => m.chit_group_id);
    const filter = groupIds.length ? { chit_group_id: { $in: groupIds } } : { _id: null };
    const auctions = await Auction.find(filter)
      .populate('chit_group_id', 'group_name chit_value group_number')
      .sort({ auction_date: -1 })
      .limit(20);
    const data = auctions.map(a => ({ ...a.toObject(), chitGroup: a.chit_group_id, status: normalizeStatus(a.status) }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getAuctionById = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('chit_group_id')
      .populate('winner_id', 'full_name');
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    const bids = await Bid.find({ auction_id: auction._id }).populate('user_id', 'full_name').sort({ bid_amount: -1 }).limit(10);
    const data = { ...auction.toObject(), chitGroup: auction.chit_group_id, bids, status: normalizeStatus(auction.status) };
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getAuctionBids = async (req, res, next) => {
  try {
    const bids = await Bid.find({ auction_id: req.params.id })
      .populate('user_id', 'full_name')
      .sort({ bid_amount: -1 });
    const data = bids.map(b => ({ ...b.toObject(), bidder: b.user_id }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.placeBid = async (req, res, next) => {
  try {
    const { bid_amount } = req.body;
    const userId = req.user._id || req.user.id;
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (auction.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Auction is not live' });

    const membership = await ChitMember.findOne({ chit_group_id: auction.chit_group_id, user_id: userId });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this group' });
    if (membership.has_won_auction) return res.status(400).json({ success: false, message: 'Already won an auction' });

    const bid = await Bid.create({ auction_id: auction._id, user_id: userId, ticket_number: membership.ticket_number, bid_amount });

    const io = req.app.get('io');
    if (io) {
      io.to('auction:' + auction._id).emit('new_bid', {
        auction_id: String(auction._id),
        bid_amount: Number(bid_amount),
        bidder_name: req.user.full_name,
        user_id: userId,
        timestamp: new Date()
      });
    }
    res.status(201).json({ success: true, message: 'Bid placed', data: bid });
  } catch (err) { next(err); }
};
`);

// ─── controllers/documentController.js ───────────────────────────────────────
write('controllers/documentController.js', `const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Document } = require('../models');

const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
const s3 = USE_S3 ? new AWS.S3({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }) : null;
const BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/documents');

function buildFileUrl(s3Key) {
  if (CLOUDFRONT_URL) return CLOUDFRONT_URL + '/' + s3Key;
  return 'https://' + BUCKET + '.s3.' + process.env.AWS_REGION + '.amazonaws.com/' + s3Key;
}

exports.getMyDocuments = async (req, res, next) => {
  try {
    const docs = await Document.find({ user_id: req.user._id || req.user.id }).sort({ created_at: -1 });
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const { document_type, chit_group_id } = req.body;
    if (!document_type) return res.status(400).json({ success: false, message: 'document_type required' });

    const ext = path.extname(req.file.originalname);
    const fileName = uuidv4() + ext;
    let fileUrl, s3Key = null;

    if (USE_S3) {
      s3Key = 'documents/' + (req.user._id || req.user.id) + '/' + fileName;
      await s3.upload({ Bucket: BUCKET, Key: s3Key, Body: req.file.buffer, ContentType: req.file.mimetype, ServerSideEncryption: 'AES256' }).promise();
      fileUrl = buildFileUrl(s3Key);
    } else {
      if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileName), req.file.buffer);
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:' + (process.env.PORT || 5000);
      fileUrl = baseUrl + '/uploads/documents/' + fileName;
    }

    const doc = await Document.create({
      user_id: req.user._id || req.user.id,
      chit_group_id: chit_group_id || null,
      document_type,
      document_name: req.file.originalname,
      file_name: req.file.originalname,
      file_url: fileUrl,
      s3_key: s3Key,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    });
    res.status(201).json({ success: true, message: 'Document uploaded', data: doc });
  } catch (err) { next(err); }
};

exports.getDocumentById = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user_id: req.user._id || req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user_id: req.user._id || req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (doc.s3_key && USE_S3) {
      await s3.deleteObject({ Bucket: BUCKET, Key: doc.s3_key }).promise();
    } else if (!USE_S3 && doc.file_url) {
      const local = path.join(LOCAL_UPLOAD_DIR, path.basename(doc.file_url));
      if (fs.existsSync(local)) fs.unlinkSync(local);
    }
    await Document.findByIdAndDelete(doc._id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
};
`);

// ─── controllers/paymentController.js ────────────────────────────────────────
write('controllers/paymentController.js', `const { Payment, ChitGroup, ChitMember, User } = require('../models');
const axios = require('axios');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const getCashfree = () => {
  const isTest = process.env.CASHFREE_ENV !== 'PROD';
  return {
    baseUrl: isTest ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg',
    paymentPageUrl: isTest ? 'https://payments-test.cashfree.com/order/' : 'https://payments.cashfree.com/order/',
    headers: { 'x-api-version': '2023-08-01', 'x-client-id': process.env.CASHFREE_APP_ID || '', 'x-client-secret': process.env.CASHFREE_SECRET_KEY || '', 'Content-Type': 'application/json' },
  };
};

async function handlePaymentSuccess(payment) {
  try {
    const user = await User.findById(payment.user_id).select('full_name email mobile credit_score');
    if (!user) return;
    const newScore = Math.min(900, (user.credit_score || 650) + 10);
    await User.findByIdAndUpdate(user._id, { credit_score: newScore });
    if (user.mobile) {
      notificationService.sendSMS(user.mobile, 'Dear ' + user.full_name + ', your payment of ₹' + parseFloat(payment.total_amount || payment.amount).toFixed(2) + ' has been received. Ref: ' + payment.payment_number + ' - Assure ChitFunds').catch(() => {});
    }
  } catch (_) {}
}

exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { chit_group_id, month_number, amount, late_fee = 0, payment_type = 'installment' } = req.body;
    if (!chit_group_id || !month_number || !amount) return res.status(400).json({ success: false, message: 'chit_group_id, month_number, amount required' });

    const userId = req.user._id || req.user.id;
    const member = await ChitMember.findOne({ chit_group_id, user_id: userId, is_active: true });
    if (!member) return res.status(403).json({ success: false, message: 'Not an active member' });

    const existing = await Payment.findOne({ chit_group_id, user_id: userId, month_number, payment_status: 'success' });
    if (existing) return res.status(400).json({ success: false, message: 'Month already paid' });

    const [user, group] = await Promise.all([
      User.findById(userId).select('full_name email mobile member_id'),
      ChitGroup.findById(chit_group_id).select('group_name group_number commencement_date duration_months'),
    ]);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });

    const start = group.commencement_date ? new Date(group.commencement_date) : new Date();
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + (month_number - 1));

    const parsedAmount = parseFloat(amount);
    const parsedLateFee = parseFloat(late_fee) || 0;
    const totalAmount = Math.round((parsedAmount + parsedLateFee) * 100) / 100;
    const payCount = await Payment.countDocuments();
    const paymentNumber = 'PAY' + new Date().getFullYear() + String(payCount + 1).padStart(6, '0');

    const payment = await Payment.create({
      payment_number: paymentNumber,
      user_id: userId,
      chit_group_id,
      month_number,
      payment_type,
      amount: parsedAmount,
      late_fee: parsedLateFee,
      total_amount: totalAmount,
      payment_method: 'online',
      payment_gateway: 'Cashfree',
      payment_status: 'pending',
      due_date: dueDate,
    });

    const cfOrderId = 'ACF-' + payment.payment_number + '-' + Date.now().toString(36).toUpperCase();
    const cf = getCashfree();
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const webUrl = process.env.WEB_CLIENT_URL || 'http://localhost:3000';
    const returnUrl = webUrl + '/payments?order_id=' + cfOrderId + '&payment_id=' + payment._id;
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    const notifyUrl = isLocalhost ? undefined : baseUrl + '/api/v1/payments/webhook/cashfree';

    if (!process.env.CASHFREE_APP_ID) {
      return res.json({
        success: true,
        data: { payment_id: String(payment._id), payment_url: null, order_id: cfOrderId, message: 'Cashfree not configured — set CASHFREE_APP_ID in .env' }
      });
    }

    const orderMeta = { return_url: returnUrl };
    if (notifyUrl) orderMeta.notify_url = notifyUrl;

    const cfRes = await axios.post(cf.baseUrl + '/orders', {
      order_id: cfOrderId, order_amount: totalAmount, order_currency: 'INR',
      customer_details: { customer_id: String(user._id), customer_name: user.full_name, customer_email: user.email, customer_phone: '91' + user.mobile },
      order_meta: orderMeta,
    }, { headers: cf.headers });

    const paymentSessionId = cfRes.data?.payment_session_id;
    await Payment.findByIdAndUpdate(payment._id, { cashfree_order_id: cfOrderId });
    const paymentUrl = cf.paymentPageUrl + cfOrderId;

    res.json({ success: true, data: { payment_id: String(payment._id), order_id: cfOrderId, payment_session_id: paymentSessionId, payment_url: paymentUrl } });
  } catch (err) { next(err); }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { order_id, payment_id } = req.body;
    if (!order_id || !payment_id) return res.status(400).json({ success: false, message: 'order_id and payment_id required' });

    const payment = await Payment.findById(payment_id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.payment_status === 'success') return res.json({ success: true, message: 'Already verified', data: payment });

    const cf = getCashfree();
    const res2 = await axios.get(cf.baseUrl + '/orders/' + order_id, { headers: cf.headers });
    const orderStatus = res2.data?.order_status;

    if (orderStatus === 'PAID') {
      await Payment.findByIdAndUpdate(payment._id, { payment_status: 'success', payment_date: new Date(), transaction_id: res2.data?.cf_order_id || order_id });
      const updated = await Payment.findById(payment._id);
      await handlePaymentSuccess(updated);
      return res.json({ success: true, message: 'Payment verified', data: updated });
    }
    res.json({ success: false, message: 'Payment not completed', data: { order_status: orderStatus } });
  } catch (err) { next(err); }
};

exports.cashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY || '').update(timestamp + body).digest('base64');
    if (signature !== expected) return res.status(400).json({ message: 'Invalid signature' });

    const { data, type } = req.body;
    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = data?.order?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ cashfree_order_id: orderId });
        if (payment && payment.payment_status !== 'success') {
          await Payment.findByIdAndUpdate(payment._id, { payment_status: 'success', payment_date: new Date(), transaction_id: data?.payment?.cf_payment_id });
          const updated = await Payment.findById(payment._id);
          await handlePaymentSuccess(updated);
        }
      }
    }
    res.json({ status: 'ok' });
  } catch (err) { res.json({ status: 'ok' }); }
};

exports.getMyPayments = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const payments = await Payment.find({ user_id: userId })
      .populate('chit_group_id', 'group_name group_number')
      .sort({ created_at: -1 });
    const data = payments.map(p => ({ ...p.toObject(), id: p._id, chitGroup: p.chit_group_id, chit_group: p.chit_group_id }));
    const paid = data.filter(p => p.payment_status === 'success' || p.payment_status === 'paid');
    const upcoming = data.filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue');
    res.json({ success: true, data: { paid, upcoming, all: data } });
  } catch (err) { next(err); }
};

exports.getUpcomingPayments = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const payments = await Payment.find({ user_id: userId, payment_status: { $in: ['pending', 'overdue'] } })
      .populate('chit_group_id', 'group_name group_number')
      .sort({ due_date: 1 });
    const now = new Date();
    const data = payments.map(p => {
      const isOverdue = p.due_date && new Date(p.due_date) < now;
      const daysOverdue = isOverdue ? Math.floor((now - new Date(p.due_date)) / (1000 * 60 * 60 * 24)) : 0;
      return { ...p.toObject(), id: p._id, chitGroup: p.chit_group_id, chit_group: p.chit_group_id, payment_status: isOverdue ? 'overdue' : 'pending', days_overdue: daysOverdue };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
`);

// ─── cron/reminders.js ────────────────────────────────────────────────────────
write('cron/reminders.js', `const cron = require('node-cron');
const { Payment, User, ChitGroup, ChitMember } = require('../models');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

cron.schedule('30 3 * * *', async () => {
  logger.info('[Cron] Running payment reminder job...');
  try {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const upcoming = await Payment.find({
      payment_status: 'pending',
      due_date: { $gte: today, $lte: threeDaysLater },
    }).populate('user_id', 'full_name mobile email')
      .populate('chit_group_id', 'group_name');

    let sent = 0;
    for (const payment of upcoming) {
      const user = payment.user_id;
      if (!user?.mobile) continue;
      const dueDate = new Date(payment.due_date).toLocaleDateString('en-IN');
      const amount = parseFloat(payment.total_amount || payment.amount).toFixed(2);
      const groupName = payment.chit_group_id?.group_name || 'your group';
      const msg = 'Dear ' + user.full_name + ', your chit payment of Rs.' + amount + ' for ' + groupName + ' is due on ' + dueDate + '. Pay on time to avoid late fees. - Assure ChitFunds';
      try { await notificationService.sendSMS(user.mobile, msg); sent++; }
      catch (e) { logger.warn('[Cron] SMS failed for user ' + user._id + ': ' + e.message); }
    }
    logger.info('[Cron] Payment reminders sent: ' + sent + '/' + upcoming.length);
  } catch (err) { logger.error('[Cron] Payment reminder job failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });

cron.schedule('30 18 * * *', async () => {
  logger.info('[Cron] Running overdue check job...');
  try {
    const today = new Date();
    const overdue = await Payment.find({ payment_status: 'pending', due_date: { $lt: today }, late_fee: 0 })
      .populate('chit_group_id', 'monthly_installment');

    let updated = 0;
    const lateFeeRate = 0.02;
    for (const payment of overdue) {
      const installment = payment.chit_group_id?.monthly_installment || payment.amount || 0;
      const fee = Math.round(installment * lateFeeRate * 100) / 100;
      if (fee > 0) {
        await Payment.findByIdAndUpdate(payment._id, { late_fee: fee, total_amount: payment.amount + fee });
        updated++;
      }
    }
    logger.info('[Cron] Late fees applied: ' + updated + '/' + overdue.length);
  } catch (err) { logger.error('[Cron] Overdue check job failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });

logger.info('[Cron] Scheduled jobs registered');
`);

console.log('\nAll backend files written successfully!');
