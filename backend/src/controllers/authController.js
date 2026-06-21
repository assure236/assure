const { User, Referral, Notification } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const { audit, getIp } = require('../utils/audit');
const { sendOTP, sendEmail } = require('../services/notificationService');

const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;

const qrSessionStore = new Map();
const QR_SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes

function genOtp() { return Math.floor(100000 + Math.random() * 900000).toString(); }

const generateToken = (userId, tokenVersion = 0, extraClaims = {}) =>
  jwt.sign({ userId, tv: tokenVersion, ...extraClaims }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

const generateRefreshToken = (userId, tokenVersion = 0, extraClaims = {}) =>
  jwt.sign({ userId, tv: tokenVersion, ...extraClaims }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

exports.resendOtp = async (req, res, next) => {
  try {
    const { mobile, email, type } = req.body;
    if (type === 'email' && email) {
      const otp = genOtp();
      otpStore.set('email:' + email, { otp, expires: Date.now() + OTP_TTL_MS, verified: false });
      await sendEmail(email, 'Your Assure ChitFunds Verification Code',
        `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="background:#0B1F3B;padding:28px;text-align:center">
            <h1 style="color:#D4AF37;margin:0;font-size:22px;letter-spacing:0.5px">Assure ChitFunds</h1>
            <p style="color:#ffffffb3;margin:6px 0 0;font-size:13px">Secure. Transparent. Rewarding.</p>
          </div>
          <div style="padding:32px 28px">
            <p style="color:#333;font-size:15px;margin:0 0 8px">We received a verification request for this email address. Use the code below to complete your verification:</p>
            <div style="background:#F8F9FB;border:2px dashed #D4AF37;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
              <p style="color:#666;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Your One-Time Password</p>
              <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0B1F3B">${otp}</span>
            </div>
            <p style="color:#555;font-size:13px;margin:0 0 8px">This code is valid for <strong>10 minutes</strong> and can only be used once.</p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-top:16px">
              <p style="color:#b91c1c;font-size:13px;margin:0"><strong>&#9888; Security Alert:</strong> Do not share this OTP with anyone, including Assure ChitFunds staff. We will <u>never</u> ask for your OTP.</p>
            </div>
          </div>
          <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center">
            <p style="color:#999;font-size:11px;margin:0">If you did not request this code, please ignore this email or contact <a href="mailto:support@assure.fund" style="color:#1E3A8A">support@assure.fund</a> immediately.</p>
            <p style="color:#bbb;font-size:11px;margin:4px 0 0">&copy; ${new Date().getFullYear()} Assure ChitFunds. All rights reserved.</p>
          </div>
        </div>`);
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
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP not sent or already used.' });
    }
    if (Date.now() > record.expires) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP expired.' });
    }
    const storedOtp = String(record.otp).trim();
    const providedOtp = String(otp).trim();
    if (storedOtp !== providedOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
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
      const bonusAmount = parseInt(process.env.REFERRAL_BONUS_AMOUNT) || 100;
      await Referral.create({
        referrer_id: referred_by,
        referred_id: user._id,
        referral_code_used: referral_code,
        bonus_amount: bonusAmount,
        bonus_credited: false,
        status: 'pending',
      });

      // Notify referrer
      try {
        await Notification.create({
          user_id: referred_by,
          type: 'referral_bonus',
          title: 'Referral Registered 🎉',
          message: `${user.full_name} joined using your referral code. ₹${bonusAmount} will be applied to your next installment after their first chit enrollment.`,
        });
      } catch (_) { /* ignore notification errors */ }
    }

    otpStore.delete('mobile:' + mobile);
    otpStore.delete('email:' + email);

    const token = generateToken(user._id, user.token_version || 0);
    const refreshToken = generateRefreshToken(user._id, user.token_version || 0);

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
    user.token_version = (user.token_version || 0) + 1; // Invalidate all other sessions on new login
    await user.save();

    // Notify existing sessions about new login & force logout
    const io = req.app.get('io');
    if (io) {
      const { device_name, platform } = req.body;
      io.to(`user:${user._id}`).emit('force_logout', {
        message: 'You have been logged out because a new login was detected.',
        device_name: device_name || 'Unknown device',
        platform: platform || 'Unknown',
        logged_in_at: new Date().toISOString(),
      });
    }

    // Invalidate auth middleware cache
    const { invalidateUserCache } = require('../middleware/auth');
    invalidateUserCache(String(user._id));

    const token = generateToken(user._id, user.token_version || 0);
    const refreshToken = generateRefreshToken(user._id, user.token_version || 0);

    const loginUserObj = user.toObject();
    delete loginUserObj.password_hash;
    loginUserObj.id = loginUserObj._id;

    res.json({
      success: true,
      data: {
        token, refreshToken,
        user: loginUserObj
      }
    });

    // Audit log (non-blocking)
    audit({ userId: user._id, userName: user.full_name, userRole: user.role, action: 'login', resourceType: 'user', resourceId: String(user._id), description: `Login via ${mobile ? 'mobile' : 'email'}`, ipAddress: getIp(req) });
  } catch (error) { next(error); }
};

exports.adminLogin = exports.login;

// ── Login with OTP (no MPIN required) ─────────────────────────────────────────
exports.loginWithOtp = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ success: false, message: 'Mobile and OTP required' });

    const key = 'mobile:' + mobile;
    const record = otpStore.get(key);
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP not sent or already used.' });
    }
    if (Date.now() > record.expires) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP expired.' });
    }
    const storedOtp = String(record.otp).trim();
    const providedOtp = String(otp).trim();
    if (storedOtp !== providedOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const user = await User.findOne({ mobile });
    if (!user) return res.status(401).json({ success: false, message: 'No account found with this mobile number' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

    const platform = String(req.body.platform || '').toLowerCase();
    const isWebLogin = platform === 'web';

    user.last_login_at = new Date();
    if (isWebLogin) {
      // Web login should only invalidate other web sessions.
      user.web_token_version = (user.web_token_version || 0) + 1;
    } else {
      // Mobile login should invalidate all sessions (mobile + web).
      user.token_version = (user.token_version || 0) + 1;
    }
    await user.save();
    otpStore.delete(key);

    // Notify existing sessions about new login / force logout
    const io = req.app.get('io');
    if (io) {
      const { device_name, platform: devicePlatform } = req.body;
      if (isWebLogin) {
        io.to(`user:${user._id}`).emit('force_logout_web', {
          message: 'Your web session was logged out because a new web login was detected.',
          device_name: device_name || 'Web browser',
          platform: 'web',
          logged_in_at: new Date().toISOString(),
        });
      } else {
        io.to(`user:${user._id}`).emit('force_logout', {
          message: 'You have been logged out because a new login was detected.',
          device_name: device_name || 'Unknown device',
          platform: devicePlatform || 'Unknown',
          logged_in_at: new Date().toISOString(),
        });
      }
    }

    // Invalidate auth middleware cache so old tokens fail immediately
    const { invalidateUserCache } = require('../middleware/auth');
    invalidateUserCache(String(user._id));

    const token = isWebLogin
      ? generateToken(user._id, user.token_version || 0, { ch: 'web', wv: user.web_token_version || 0 })
      : generateToken(user._id, user.token_version || 0);
    const refreshToken = isWebLogin
      ? generateRefreshToken(user._id, user.token_version || 0, { ch: 'web', wv: user.web_token_version || 0 })
      : generateRefreshToken(user._id, user.token_version || 0);

    const userObj = user.toObject();
    delete userObj.password_hash;
    userObj.id = userObj._id;

    res.json({
      success: true,
      data: {
        token, refreshToken,
        user: userObj
      }
    });
  } catch (error) { next(error); }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-password_hash');
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    // Check token_version — if bumped, all old tokens are invalid
    if (decoded.tv !== undefined && decoded.tv !== (user.token_version || 0)) {
      return res.status(401).json({ success: false, message: 'Session invalidated. Please login again.' });
    }
    // For web sessions, also validate web_token_version so only one web session stays active.
    if (decoded.ch === 'web') {
      if (decoded.wv !== undefined && decoded.wv !== (user.web_token_version || 0)) {
        return res.status(401).json({ success: false, message: 'Web session invalidated. Please login again.' });
      }
    }

    const token = decoded.ch === 'web'
      ? generateToken(user._id, user.token_version || 0, { ch: 'web', wv: user.web_token_version || 0 })
      : generateToken(user._id, user.token_version || 0);
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

exports.logoutAllDevices = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.token_version = (user.token_version || 0) + 1;
    await user.save();
    // Invalidate auth middleware cache so old tokens fail immediately
    const { invalidateUserCache } = require('../middleware/auth');
    invalidateUserCache(String(userId));

    // Notify all connected sockets for this user to force logout
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('force_logout', {
        message: 'You have been logged out from all devices.',
      });
    }

    res.json({ success: true, message: 'All devices logged out. Please login again.' });

    // Audit log
    audit({ userId, userName: user.full_name, userRole: user.role, action: 'logout_all_devices', resourceType: 'user', resourceId: String(userId), description: 'Logged out all devices', ipAddress: getIp(req) });
  } catch (error) { next(error); }
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
    const { sessionId, active_member_id: requestedMemberId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });
    const session = qrSessionStore.get(sessionId);
    if (!session || Date.now() > session.expires) {
      qrSessionStore.delete(sessionId);
      return res.status(404).json({ success: false, message: 'QR session not found or expired' });
    }
    if (session.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'QR already used' });
    }

    // Resolve active member context — if the mobile user selected a family member,
    // issue the web token for that member so the web portal opens as them.
    const authUser = req.auth_user || req.user;
    let effectiveUser = authUser;
    if (requestedMemberId) {
      const { resolveActiveMemberContextPublic } = require('../middleware/auth');
      // Fallback: inline resolution when export not available
      const memberId = String(requestedMemberId).trim().toUpperCase();
      if (memberId && memberId !== 'ME' && (authUser.member_id || '').toUpperCase() !== memberId) {
        const FamilyMember = require('../models').FamilyMember;
        const targetUser = await User.findOne({ member_id: memberId, is_active: true }).select('-password_hash').lean();
        if (targetUser) {
          const relation = await FamilyMember.findOne({
            user_id: authUser._id,
            is_active: true,
            status: { $in: ['approved', 'linked'] },
            $or: [{ linked_user_id: targetUser._id }, { member_id: targetUser.member_id }],
          }).select('_id').lean();
          if (relation) {
            effectiveUser = { ...targetUser, id: String(targetUser._id) };
          }
        }
      }
    }

    const userId = effectiveUser._id || effectiveUser.id;

    // QR is a web login: invalidate only web sessions, not mobile sessions.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.last_login_at = new Date();
    user.web_token_version = (user.web_token_version || 0) + 1;
    await user.save();

    // Also notify primary account's web session to force logout
    const primaryId = String(authUser._id || authUser.id);
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${primaryId}`).emit('force_logout_web', {
        message: 'Your web session was logged out because a new web login was detected.',
        device_name: 'Web session',
        platform: 'web',
        logged_in_at: new Date().toISOString(),
      });
    }

    const { invalidateUserCache } = require('../middleware/auth');
    invalidateUserCache(String(userId));

    const tv = user.token_version || 0;
    const wv = user.web_token_version || 0;
    const token = generateToken(userId, tv, { ch: 'web', wv });
    const refreshToken = generateRefreshToken(userId, tv, { ch: 'web', wv });
    const userObj = {
      id: user._id,
      full_name: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      member_id: user.member_id,
      kyc_status: user.kyc_status,
    };
    session.status = 'confirmed';
    session.token = token;
    session.refreshToken = refreshToken;
    session.user = userObj;
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
