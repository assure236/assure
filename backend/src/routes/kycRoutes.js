const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/v1/kyc/status
// @desc    Get current user's KYC status
// @access  Private
router.get('/status', authMiddleware, kycController.getKycStatus);

// @route   POST /api/v1/kyc/submit-pan
// @desc    Submit PAN number for verification
// @access  Private
router.post('/submit-pan', authMiddleware, kycController.submitPan);

// @route   GET /api/v1/kyc/digilocker/init
// @desc    Get DigiLocker OAuth2 authorization URL
// @access  Private
router.get('/digilocker/init', authMiddleware, kycController.initiateDigiLocker);

// @route   GET /api/v1/kyc/digilocker/callback
// @desc    DigiLocker OAuth2 callback — exchanges code, stores documents, marks KYC verified
// @access  Public (called by DigiLocker redirect, state carries userId)
router.get('/digilocker/callback', kycController.digiLockerCallback);

module.exports = router;
