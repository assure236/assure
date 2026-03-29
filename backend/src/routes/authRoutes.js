const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/authValidator');
const { authMiddleware } = require('../middleware/auth');

// @route   POST /api/v1/auth/register
// @desc    Register new member
// @access  Public
router.post('/register', validate(registerSchema), authController.register);

// @route   POST /api/v1/auth/login
// @desc    Login user (mobile + MPIN)
// @access  Public
router.post('/login', validate(loginSchema), authController.login);

// @route   POST /api/v1/auth/admin-login
// @desc    Admin login with email + password
// @access  Public
router.post('/admin-login', authController.adminLogin);

// @route   POST /api/v1/auth/verify-otp
// @desc    Verify OTP for login/registration
// @access  Public
router.post('/verify-otp', authController.verifyOtp);

// @route   POST /api/v1/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', authController.resendOtp);

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// @route   POST /api/v1/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', authController.refreshToken);

// QR Login
router.post('/qr-generate', authController.qrGenerate);
router.get('/qr-status/:sessionId', authController.qrStatus);
router.post('/qr-confirm', authMiddleware, authController.qrConfirm);

module.exports = router;
