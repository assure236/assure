const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/my-referrals', referralController.getMyReferrals);
router.get('/my-referral-code', referralController.getMyReferralCode);
router.get('/referral-stats', referralController.getReferralStats);

module.exports = router;
