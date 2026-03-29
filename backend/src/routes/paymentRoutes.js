const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// @route   POST /api/v1/payments/create-order
// @desc    Create payment order (Cashfree)
// @access  Private
router.post('/create-order', paymentController.createPaymentOrder);

// @route   POST /api/v1/payments/verify
// @desc    Verify payment after Cashfree callback
// @access  Private
router.post('/verify', paymentController.verifyPayment);

// @route   GET /api/v1/payments/my-payments
// @desc    Get current user's payments
// @access  Private
router.get('/my-payments', paymentController.getMyPayments);

// @route   GET /api/v1/payments/due-payments
// @desc    Get user's due payments
// @access  Private
router.get('/due-payments', paymentController.getDuePayments);

// Cashfree webhook
router.post('/webhook/cashfree', paymentController.cashfreeWebhook);

// @route   GET /api/v1/payments/receipt/:id
// @desc    Download payment receipt (HTML printable)
// @access  Private
router.get('/receipt/:id', paymentController.downloadReceipt);

// @route   GET /api/v1/payments/statement
// @desc    Download account statement (CSV or JSON)
// @access  Private
router.get('/statement', paymentController.getAccountStatement);

// @route   POST /api/v1/payments/calculate-late-fee
// @desc    Calculate late fee for a payment
// @access  Private
router.post('/calculate-late-fee', paymentController.calculateLateFee);

// @route   GET /api/v1/payments/:id
// @desc    Get payment details
// @access  Private
router.get('/:id', paymentController.getPaymentById);

// Admin only routes
router.get('/', authorizeRoles('admin', 'super_admin'), paymentController.getAllPayments);
router.post('/manual-payment', authorizeRoles('admin', 'super_admin'), paymentController.recordManualPayment);
router.post('/:id/refund', authorizeRoles('admin', 'super_admin'), paymentController.refundPayment);

module.exports = router;
