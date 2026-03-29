const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', walletController.getWallet);
router.get('/transactions', walletController.getTransactions);
router.post('/deposit', walletController.deposit);
router.post('/withdraw', walletController.withdraw);
router.post('/create-deposit-order', walletController.createDepositOrder);
router.post('/verify-deposit', walletController.verifyDeposit);

module.exports = router;
