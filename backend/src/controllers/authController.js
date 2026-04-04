const { User, Referral, Wallet, WalletTransaction, Notification } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const { sendOTP, sendEmail } = require('../services/notificationService');

const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;

const qrSessionStore = new Map();
const QR_SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
      return res.json({ success: true, message: 'OTP sent to ' + email });
    }
    if (mobile) {
      const otp = genOtp();
      otpStore.set('mobile:' + mobile, { otp, expires: Date.now() + OTP_TTL_MS, verified: false });
      await sendOTP(mobile, otp);
      return res.json({ success: true, message: 'OTP sent to +91 ' + mobile });
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
      const bonusAmount = parseInt(process.env.REFERRAL_BONUS_AMOUNT) || 500;
      const referral = await Referral.create({
        referrer_id: referred_by,
        referred_id: user._id,
        referral_code_used: referral_code,
        bonus_amount: bonusAmount,
        bonus_credited: true,
        credited_at: new Date(),
        status: 'credited',
      });

      // Credit bonus to referrer's wallet
      let wallet = await Wallet.findOne({ user_id: referred_by });
      if (!wallet) {
        wallet = await Wallet.create({ user_id: referred_by, balance: 0 });
      }
      wallet.balance += bonusAmount;
      await wallet.save();

      await WalletTransaction.create({
        user_id: referred_by,
        wallet_id: wallet._id,
        type: 'reward',
        amount: bonusAmount,
        balance_after: wallet.balance,
        description: `Referral bonus — ${user.full_name} joined using your code`,
        reference_id: String(referral._id),
      });

      // Notify referrer
      try {
        await Notification.create({
          user_id: referred_by,
          type: 'referral_bonus',
          title: 'Referral Bonus Credited! 🎉',
          message: `₹${bonusAmount} credited to your wallet! ${user.full_name} joined Assure ChitFunds using your referral code.`,
        });
      } catch (_) { /* ignore notification errors */ }
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
    res.json({ success: true, message: 'OTP sent for password reset' });
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

// ── QR Login ──────────────────────────────────────────────────────────────────

exports.qrGenerate = async (req, res, next) => {
  try {
    const { randomUUID } = require('crypto');
    const sessionId = randomUUID();
    const expiresAt = Date.now() + QR_SESSION_TTL_MS;
    qrSessionStore.set(sessionId, { status: 'pending', expires: expiresAt });
    setTimeout(() => qrSessionStore.delete(sessionId), QR_SESSION_TTL_MS + 5000);
    res.json({ success: true, data: { sessionId, expiresAt } });
  } catch (error) { next(error); }
};

exports.qrStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = qrSessionStore.get(sessionId);
    if (!session || Date.now() > session.expires) {
      qrSessionStore.delete(sessionId);
      return res.json({ success: true, data: { status: 'expired' } });
    }
    if (session.status === 'confirmed') {
      const { token, refreshToken, user } = session;
      qrSessionStore.delete(sessionId);
      return res.json({ success: true, data: { status: 'confirmed', token, refreshToken, user } });
    }
    res.json({ success: true, data: { status: session.status } });
  } catch (error) { next(error); }
};

exports.qrConfirm = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });
    const session = qrSessionStore.get(sessionId);
    if (!session || Date.now() > session.expires) {
      qrSessionStore.delete(sessionId);
      return res.status(404).json({ success: false, message: 'QR session not found or expired' });
    }
    if (session.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'QR already used' });
    }
    const userId = req.user._id || req.user.id;
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);
    const user = {
      id: req.user._id,
      full_name: req.user.full_name,
      email: req.user.email,
      mobile: req.user.mobile,
      role: req.user.role,
      member_id: req.user.member_id,
      kyc_status: req.user.kyc_status,
    };
    session.status = 'confirmed';
    session.token = token;
    session.refreshToken = refreshToken;
    session.user = user;
    res.json({ success: true, message: 'QR login confirmed. Web session activated.' });
  } catch (error) { next(error); }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { ...user.toObject(), id: user._id } });
  } catch (error) { next(error); }
};
