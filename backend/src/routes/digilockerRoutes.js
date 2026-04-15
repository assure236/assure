const express = require('express');
const router = express.Router();
const digilockerController = require('../controllers/digilockerController');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/v1/digilocker/callback
// @desc    Handle DigiLocker OAuth callback (browser redirect — NO auth needed)
// @access  Public (user identified via state param → DLSession)
router.get('/callback', digilockerController.handleCallback);

// All routes below require authentication
router.use(authMiddleware);

// @route   GET /api/v1/digilocker/auth-url
// @desc    Get DigiLocker OAuth authorization URL
// @access  Private
router.get('/auth-url', digilockerController.getAuthUrl);

// @route   GET /api/v1/digilocker/status
// @desc    Check DigiLocker connection status
// @access  Private
router.get('/status', digilockerController.getStatus);

module.exports = router;
