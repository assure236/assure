const express = require('express');
const router = express.Router();
const chitGroupController = require('../controllers/chitGroupController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/v1/chit-groups
// @desc    Get all chit groups (members see active only, admins see all)
// @access  Private
router.get('/', chitGroupController.getAllChitGroups);

// @route   GET /api/v1/chit-groups/:id
// @desc    Get chit group details
// @access  Private
router.get('/:id', chitGroupController.getChitGroupById);

// @route   GET /api/v1/chit-groups/:id/members
// @desc    Get chit group members
// @access  Private
router.get('/:id/members', chitGroupController.getChitGroupMembers);

// @route   GET /api/v1/chit-groups/:id/payment-schedule
// @desc    Get payment schedule for a chit group (user's paid/pending/overdue months)
// @access  Private
router.get('/:id/payment-schedule', chitGroupController.getPaymentSchedule);

// @route   POST /api/v1/chit-groups/:id/enroll
// @desc    Enroll in a chit group
// @access  Private (Members only)
router.post('/:id/enroll', chitGroupController.enrollInChitGroup);

// @route   GET /api/v1/chit-groups/:id/analytics
// @desc    Get chit group analytics (dividend predictions, etc.)
// @access  Private
router.get('/:id/analytics', chitGroupController.getChitGroupAnalytics);

// @route   POST /api/v1/chit-groups/transfer-request
// @desc    Request chit transfer to another member
// @access  Private (Members)
router.post('/transfer-request', chitGroupController.transferChitRequest);

// @route   POST /api/v1/chit-groups/cancel-request
// @desc    Request chit membership cancellation
// @access  Private (Members)
router.post('/cancel-request', chitGroupController.cancelChitRequest);

// Admin only routes
router.post('/', authorizeRoles('admin', 'super_admin'), chitGroupController.createChitGroup);
router.put('/:id', authorizeRoles('admin', 'super_admin'), chitGroupController.updateChitGroup);
router.delete('/:id', authorizeRoles('super_admin'), chitGroupController.deleteChitGroup);
router.post('/:id/activate', authorizeRoles('admin', 'super_admin'), chitGroupController.activateChitGroup);
router.post('/:id/suspend', authorizeRoles('admin', 'super_admin'), chitGroupController.suspendChitGroup);

module.exports = router;
