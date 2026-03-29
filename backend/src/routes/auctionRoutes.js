const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/v1/auctions/upcoming
// @desc    Get upcoming auctions
// @access  Private
router.get('/upcoming', auctionController.getUpcomingAuctions);

// @route   GET /api/v1/auctions/my-auctions
// @desc    Get auctions for user's chit groups
// @access  Private
router.get('/my-auctions', auctionController.getMyAuctions);

// @route   GET /api/v1/auctions/:id
// @desc    Get auction details
// @access  Private
router.get('/:id', auctionController.getAuctionById);

// @route   GET /api/v1/auctions/:id/bids
// @desc    Get all bids for an auction
// @access  Private
router.get('/:id/bids', auctionController.getAuctionBids);

// @route   POST /api/v1/auctions/:id/bid   (also /place-bid for legacy)
// @desc    Place a bid in live auction
// @access  Private (Members only)
router.post('/:id/bid', auctionController.placeBid);
router.post('/:id/place-bid', auctionController.placeBid);

// @route   GET /api/v1/auctions/:id/live-status
// @desc    Get live auction status (for real-time updates)
// @access  Private
router.get('/:id/live-status', auctionController.getLiveAuctionStatus);

// Admin only routes
router.post('/', authorizeRoles('admin', 'super_admin'), auctionController.createAuction);
router.post('/:id/start', authorizeRoles('admin', 'super_admin'), auctionController.startAuction);
router.post('/:id/end', authorizeRoles('admin', 'super_admin'), auctionController.endAuction);
router.post('/:id/approve-disbursement', authorizeRoles('admin', 'super_admin'), auctionController.approveDisbursement);
router.post('/:id/disburse', authorizeRoles('admin', 'super_admin'), auctionController.disburseAmount);

module.exports = router;
