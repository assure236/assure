const { Wallet, WalletTransaction, User } = require('../models');
const axios = require('axios');
const crypto = require('crypto');
const { getWebClientUrl } = require('../utils/runtimeUrls');
const { sendOTP } = require('../services/notificationService');

const WITHDRAWAL_OTP_THRESHOLD = 5000;
const withdrawalOtpStore = new Map();
const WITHDRAWAL_OTP_TTL_MS = 5 * 60 * 1000;

const getCashfree = () => {
  const isTest = process.env.CASHFREE_ENV !== 'PROD';
  return {
    baseUrl: isTest ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg',
    headers: { 'x-api-version': '2023-08-01', 'x-client-id': process.env.CASHFREE_APP_ID || '', 'x-client-secret': process.env.CASHFREE_SECRET_KEY || '', 'Content-Type': 'application/json' },
  };
};

// Get or create wallet for user
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user_id: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user_id: userId, balance: 0 });
  }
  return wallet;
};

// GET /wallet — Get wallet balance
exports.getWallet = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const wallet = await getOrCreateWallet(userId);
    res.json({ success: true, data: { balance: wallet.balance, wallet_id: wallet._id } });
  } catch (err) { next(err); }
};

// GET /wallet/transactions — Get transaction history
exports.getTransactions = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const wallet = await getOrCreateWallet(userId);
    const total = await WalletTransaction.countDocuments({ wallet_id: wallet._id });
    const transactions = await WalletTransaction.find({ wallet_id: wallet._id })
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, data: { transactions, total, page: parseInt(page), balance: wallet.balance } });
  } catch (err) { next(err); }
};

// POST /wallet/deposit — Add money to wallet
exports.deposit = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { amount, description, reference_id } = req.body;
    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (depositAmount > 1000000) {
      return res.status(400).json({ success: false, message: 'Maximum deposit is ₹10,00,000' });
    }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = wallet.balance + depositAmount;

    await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
    await WalletTransaction.create({
      user_id: userId,
      wallet_id: wallet._id,
      type: 'deposit',
      amount: depositAmount,
      balance_after: newBalance,
      description: description || 'Wallet deposit',
      reference_id,
    });

    res.json({ success: true, message: 'Deposit successful', data: { balance: newBalance } });
  } catch (err) { next(err); }
};

// POST /wallet/withdraw — Withdraw from wallet
exports.withdraw = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { amount, description, withdrawal_otp } = req.body;
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (withdrawAmount >= WITHDRAWAL_OTP_THRESHOLD) {
      const otpKey = String(userId);
      const now = Date.now();
      const entry = withdrawalOtpStore.get(otpKey);
      if (!withdrawal_otp) {
        // SECURITY FIX: enforce OTP step-up auth for high-value wallet withdrawals.
        // SECURITY FIX: use cryptographically secure RNG for withdrawal OTP.
        const generatedOtp = crypto.randomInt(100000, 1000000).toString();
        withdrawalOtpStore.set(otpKey, { otp: generatedOtp, expiresAt: now + WITHDRAWAL_OTP_TTL_MS });
        const user = await User.findById(userId).select('mobile');
        if (user?.mobile) {
          await sendOTP(user.mobile, generatedOtp);
        }
        return res.status(202).json({
          success: true,
          message: 'OTP sent to your registered mobile. Provide it to confirm withdrawal.',
          requires_otp: true,
        });
      }
      if (!entry || now > entry.expiresAt || String(entry.otp) !== String(withdrawal_otp).trim()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }
      withdrawalOtpStore.delete(otpKey);
    }

    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const newBalance = wallet.balance - withdrawAmount;
    await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
    await WalletTransaction.create({
      user_id: userId,
      wallet_id: wallet._id,
      type: 'withdrawal',
      amount: withdrawAmount,
      balance_after: newBalance,
      description: description || 'Wallet withdrawal',
      status: 'pending', // withdrawals need admin approval
    });

    res.json({ success: true, message: 'Withdrawal request submitted', data: { balance: newBalance } });
  } catch (err) { next(err); }
};

// Helper — deduct bid fee (used by auction controller)
exports.deductBidFee = async (userId, bidFee, auctionId) => {
  if (!bidFee || bidFee <= 0) return { success: true };
  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < bidFee) {
    return { success: false, message: `Insufficient wallet balance. Need ₹${bidFee}, have ₹${wallet.balance}` };
  }
  const newBalance = wallet.balance - bidFee;
  await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
  await WalletTransaction.create({
    user_id: userId,
    wallet_id: wallet._id,
    type: 'bid_fee',
    amount: bidFee,
    balance_after: newBalance,
    description: `Bid fee for auction`,
    reference_id: String(auctionId),
  });
  return { success: true, balance: newBalance };
};

// Helper — get wallet balance 
exports.getBalance = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance;
};

// Helper — get available balance (balance minus locked)
exports.getAvailableBalance = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance - (wallet.locked_balance || 0);
};

// Helper — lock bid amount in wallet (move from available to locked)
exports.lockBidAmount = async (userId, amount, auctionId) => {
  if (!amount || amount <= 0) return { success: true };
  const wallet = await getOrCreateWallet(userId);
  const available = wallet.balance - (wallet.locked_balance || 0);
  if (available < amount) {
    return { success: false, message: `Insufficient available balance. Need ₹${amount}, available ₹${available}` };
  }
  const newLocked = (wallet.locked_balance || 0) + amount;
  await Wallet.findByIdAndUpdate(wallet._id, { locked_balance: newLocked });
  await WalletTransaction.create({
    user_id: userId,
    wallet_id: wallet._id,
    type: 'bid_lock',
    amount,
    balance_after: wallet.balance,
    description: `Bid locked for auction`,
    reference_id: String(auctionId),
  });
  return { success: true, balance: wallet.balance, locked: newLocked };
};

// Helper — unlock bid amount (release from locked back to available)
exports.unlockBidAmount = async (userId, amount, auctionId) => {
  if (!amount || amount <= 0) return { success: true };
  const wallet = await getOrCreateWallet(userId);
  const newLocked = Math.max(0, (wallet.locked_balance || 0) - amount);
  await Wallet.findByIdAndUpdate(wallet._id, { locked_balance: newLocked });
  await WalletTransaction.create({
    user_id: userId,
    wallet_id: wallet._id,
    type: 'bid_unlock',
    amount,
    balance_after: wallet.balance,
    description: `Bid unlocked (outbid) for auction`,
    reference_id: String(auctionId),
  });
  return { success: true, balance: wallet.balance, locked: newLocked };
};

// Helper — settle winner's locked amount (deduct from balance + locked)
exports.settleWinnerLock = async (userId, amount, auctionId) => {
  if (!amount || amount <= 0) return { success: true };
  const wallet = await getOrCreateWallet(userId);
  const newLocked = Math.max(0, (wallet.locked_balance || 0) - amount);
  const newBalance = wallet.balance - amount;
  await Wallet.findByIdAndUpdate(wallet._id, { balance: Math.max(0, newBalance), locked_balance: newLocked });
  return { success: true, balance: Math.max(0, newBalance), locked: newLocked };
};

exports.getOrCreateWallet = getOrCreateWallet;

// POST /wallet/create-deposit-order — Create Cashfree order for wallet top-up
exports.createDepositOrder = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { amount } = req.body;
    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (depositAmount > 1000000) {
      return res.status(400).json({ success: false, message: 'Maximum deposit is ₹10,00,000' });
    }

    const user = await User.findById(userId).select('full_name email mobile');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const orderId = 'WD-' + Date.now().toString(36).toUpperCase() + '-' + String(userId).slice(-6);
    const cf = getCashfree();
    const webUrl = getWebClientUrl();
    const returnUrl = webUrl ? (webUrl + '/wallet?deposit_order=' + orderId) : undefined;

    if (!process.env.CASHFREE_APP_ID) {
      return res.json({ success: true, data: { order_id: orderId, payment_url: null, message: 'Cashfree not configured' } });
    }

    const cfRes = await axios.post(cf.baseUrl + '/orders', {
      order_id: orderId,
      order_amount: depositAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: String(userId),
        customer_name: user.full_name,
        customer_email: user.email || 'noemail@example.com',
        customer_phone: '91' + user.mobile,
      },
      order_meta: returnUrl ? { return_url: returnUrl } : undefined,
    }, { headers: cf.headers });

    const paymentSessionId = cfRes.data?.payment_session_id;
    const isTest = process.env.CASHFREE_ENV !== 'PROD';
    const paymentUrl = (isTest ? 'https://payments-test.cashfree.com/order/' : 'https://payments.cashfree.com/order/') + orderId;

    res.json({
      success: true,
      data: { order_id: orderId, payment_session_id: paymentSessionId, payment_url: paymentUrl, amount: depositAmount },
    });
  } catch (err) { next(err); }
};

// POST /wallet/verify-deposit — Verify Cashfree wallet deposit and credit balance
exports.verifyDeposit = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });

    const cf = getCashfree();
    const cfRes = await axios.get(cf.baseUrl + '/orders/' + order_id, { headers: cf.headers });
    const orderStatus = cfRes.data?.order_status;
    const orderAmount = cfRes.data?.order_amount;

    if (orderStatus === 'PAID') {
      // Prevent double-credit: check if this order was already processed
      const existing = await WalletTransaction.findOne({ reference_id: order_id, type: 'deposit' });
      if (existing) {
        const wallet = await getOrCreateWallet(userId);
        return res.json({ success: true, message: 'Already credited', data: { balance: wallet.balance } });
      }

      const wallet = await getOrCreateWallet(userId);
      const newBalance = wallet.balance + orderAmount;
      await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
      await WalletTransaction.create({
        user_id: userId,
        wallet_id: wallet._id,
        type: 'deposit',
        amount: orderAmount,
        balance_after: newBalance,
        description: 'Wallet deposit via Cashfree',
        reference_id: order_id,
      });
      return res.json({ success: true, message: 'Deposit successful', data: { balance: newBalance } });
    }

    res.json({ success: false, message: 'Payment not completed', data: { order_status: orderStatus } });
  } catch (err) { next(err); }
};
