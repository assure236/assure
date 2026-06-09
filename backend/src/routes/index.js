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
// Old DigiLocker OAuth removed — using Cashfree DigiLocker via /onboarding routes
const loanRoutes = require('./loanRoutes');
const livenessRoutes = require('./livenessRoutes');
const fileRoutes = require('./fileRoutes');
const onboardingRoutes = require('./onboardingRoutes');

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
// /digilocker route removed — using Cashfree via /onboarding/digilocker/*
router.use('/loans', loanRoutes);
router.use('/liveness', livenessRoutes);
router.use('/onboarding', onboardingRoutes);

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
