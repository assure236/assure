const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// @route   POST /api/v1/chatbot/chat
// @desc    Send message to chatbot
// @access  Private
router.post('/chat', chatbotController.chat);

module.exports = router;
