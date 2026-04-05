const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const chitGroupRoutes = require('./chitGroupRoutes');
const auctionRoutes = require('./auctionRoutes');
const paymentRoutes = require('./paymentRoutes');
const documentRoutes = require('./documentRoutes');
const notificationRoutes = require('./notificationRoutes');
const referralRoutes = require('./referralRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const kycRoutes = require('./kycRoutes');
const adminRoutes = require('./adminRoutes');
const walletRoutes = require('./walletRoutes');
const chatbotRoutes = require('./chatbotRoutes');
const digilockerRoutes = require('./digilockerRoutes');
const loanRoutes = require('./loanRoutes');
const fileRoutes = require('./fileRoutes');

// Public routes
router.use('/auth', authRoutes);
router.use('/files', fileRoutes);

// Admin routes (all protected inside the router)
router.use('/admin', adminRoutes);

// Protected routes (require authentication)
router.use('/users', userRoutes);
router.use('/chit-groups', chitGroupRoutes);
router.use('/auctions', auctionRoutes);
router.use('/payments', paymentRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/referrals', referralRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/kyc', kycRoutes);
router.use('/wallet', walletRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/digilocker', digilockerRoutes);
router.use('/loans', loanRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Assure Chit Funds API',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
