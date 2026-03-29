const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/v1/dashboard/member
// @desc    Get member dashboard data
// @access  Private (Members)
router.get('/member', dashboardController.getMemberDashboard);

// @route   GET /api/v1/dashboard/admin
// @desc    Get admin dashboard data
// @access  Private (Admin only)
router.get('/admin', authorizeRoles('admin', 'super_admin'), dashboardController.getAdminDashboard);

// @route   GET /api/v1/dashboard/statistics
// @desc    Get platform statistics
// @access  Private (Admin only)
router.get('/statistics', authorizeRoles('admin', 'super_admin'), dashboardController.getStatistics);

// @route   GET /api/v1/dashboard/analytics
// @desc    Get member-specific analytics for charts
// @access  Private (Members)
router.get('/analytics', dashboardController.getMemberAnalytics);

// @route   GET /api/v1/dashboard/dividend-analytics
// @desc    Get dividend probability and bidding pattern analytics
// @access  Private (Members)
router.get('/dividend-analytics', dashboardController.getDividendAnalytics);

module.exports = router;
