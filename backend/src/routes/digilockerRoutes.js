const express = require('express');
const router = express.Router();
const digilockerController = require('../controllers/digilockerController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// @route   GET /api/v1/digilocker/auth-url
// @desc    Get DigiLocker OAuth authorization URL
// @access  Private
router.get('/auth-url', digilockerController.getAuthUrl);

// @route   POST /api/v1/digilocker/callback
// @desc    Handle DigiLocker OAuth callback
// @access  Private
router.post('/callback', digilockerController.handleCallback);

// @route   GET /api/v1/digilocker/status
// @desc    Check DigiLocker connection status
// @access  Private
router.get('/status', digilockerController.getStatus);

module.exports = router;
