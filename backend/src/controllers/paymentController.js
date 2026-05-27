const { Payment, ChitGroup, ChitMember, User, Auction, Referral } = require('../models');
const axios = require('axios');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');
const { notifyUser } = require('../utils/notifyUser');
const { audit, getIp } = require('../utils/audit');
const { getBackendBaseUrl, getWebClientUrl, isLocalUrl } = require('../utils/runtimeUrls');

const getCashfree = () => {
  const isTest = process.env.CASHFREE_ENV !== 'PROD';
  return {
    baseUrl: isTest ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg',
    paymentPageUrl: isTest ? 'https://payments-test.cashfree.com/order/' : 'https://payments.cashfree.com/order/',
    headers: { 'x-api-version': '2023-08-01', 'x-client-id': process.env.CASHFREE_APP_ID || '', 'x-client-secret': process.env.CASHFREE_SECRET_KEY || '', 'Content-Type': 'application/json' },
  };
};

async function getEligibleReferralForDiscount(userId) {
  return Referral.findOne({
    referrer_id: userId,
    status: 'credited',
    bonus_credited: true,
    discount_applied: { $ne: true },
  }).sort({ qualified_at: 1, credited_at: 1, created_at: 1 });
}

async function handlePaymentSuccess(payment) {
  try {
    const user = await User.findById(payment.user_id).select('full_name email mobile credit_score');
    if (!user) return;
    const newScore = Math.min(900, (user.credit_score || 650) + 10);
    await User.findByIdAndUpdate(user._id, { credit_score: newScore });

    // Consume referral discount only after payment is successful.
    if ((payment.referral_discount_amount || 0) > 0 && !payment.referral_discount_consumed) {
      let referralIds = (payment.referral_discount_referral_ids || []).map((id) => String(id));

      if (!referralIds.length) {
        const fallback = await getEligibleReferralForDiscount(payment.user_id);
        if (fallback) referralIds = [String(fallback._id)];
      }

      if (referralIds.length) {
        await Referral.updateMany(
          {
            _id: { $in: referralIds },
            discount_applied: { $ne: true },
          },
          {
            $set: {
              discount_applied: true,
              discount_applied_at: new Date(),
              discount_payment_id: payment._id,
            },
          }
        );
      }

      await Payment.findByIdAndUpdate(payment._id, { referral_discount_consumed: true });
    }

    if (user) {
      const msg = 'Dear ' + user.full_name + ', your payment of ₹' + parseFloat(payment.total_amount || payment.amount).toFixed(2) + ' has been received. Ref: ' + payment.payment_number;
      notifyUser(String(user._id), 'Payment Received', msg, 'payment', { payment_id: String(payment._id) }).catch(() => {});
    }
  } catch (_) {}
}

exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { chit_group_id, month_number, amount, late_fee = 0, payment_type = 'installment' } = req.body;
    if (!chit_group_id || !month_number || !amount) return res.status(400).json({ success: false, message: 'chit_group_id, month_number, amount required' });

    const userId = req.user._id || req.user.id;
    const member = await ChitMember.findOne({ chit_group_id, user_id: userId, is_active: true });
    if (!member) return res.status(403).json({ success: false, message: 'Not an active member' });
    // Clean up stale pending payments for this user+group+month (prevent duplicates)
    await Payment.deleteMany({ chit_group_id, user_id: userId, month_number, payment_status: 'pending' });

    const [user, group] = await Promise.all([
      User.findById(userId).select('full_name email mobile member_id'),
      ChitGroup.findById(chit_group_id).select('group_name group_number commencement_date duration_months monthly_installment'),
    ]);
    if (!group) return res.status(404).json({ success: false, message: 'Chit group not found' });

    const start = group.commencement_date ? new Date(group.commencement_date) : new Date();
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + (month_number - 1));

    const parsedAmount = parseFloat(amount);
    const parsedLateFee = parseFloat(late_fee) || 0;

    let referralDiscountAmount = 0;
    let referralDiscountReferralIds = [];

    if (payment_type === 'installment' && parsedAmount > 0) {
      const eligibleReferral = await getEligibleReferralForDiscount(userId);
      if (eligibleReferral) {
        const discount = Number(eligibleReferral.bonus_amount || 100);
        referralDiscountAmount = Math.min(parsedAmount, discount);
        referralDiscountReferralIds = [eligibleReferral._id];
      }
    }

    const discountedInstallmentAmount = Math.max(0, parsedAmount - referralDiscountAmount);
    const totalAmount = Math.round((discountedInstallmentAmount + parsedLateFee) * 100) / 100;
    const paymentNumber = 'PAY' + new Date().getFullYear() + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    const payment = await Payment.create({
      payment_number: paymentNumber,
      user_id: userId,
      chit_group_id,
      month_number,
      payment_type,
      amount: discountedInstallmentAmount,
      late_fee: parsedLateFee,
      total_amount: totalAmount,
      payment_method: 'online',
      payment_gateway: 'Cashfree',
      payment_status: 'pending',
      due_date: dueDate,
      referral_discount_amount: referralDiscountAmount,
      referral_discount_referral_ids: referralDiscountReferralIds,
      referral_discount_consumed: false,
    });

    const cfOrderId = 'ACF-' + payment.payment_number + '-' + Date.now().toString(36).toUpperCase();
    const cf = getCashfree();
    const backendUrl = getBackendBaseUrl(req);
    const webUrl = getWebClientUrl();
    const isLocalhost = isLocalUrl(backendUrl) || isLocalUrl(webUrl);
    const notifyUrl = (!isLocalhost && backendUrl) ? (backendUrl + '/api/v1/payments/webhook/cashfree') : undefined;

    // Cashfree PROD requires HTTPS return_url; skip for localhost
    const returnUrl = (webUrl && webUrl.startsWith('https://'))
      ? (webUrl + '/payments?order_id=' + cfOrderId + '&payment_id=' + payment._id)
      : undefined;

    if (!process.env.CASHFREE_APP_ID) {
      return res.json({
        success: true,
        data: { payment_id: String(payment._id), payment_url: null, order_id: cfOrderId, message: 'Cashfree not configured — set CASHFREE_APP_ID in .env' }
      });
    }

    const orderMeta = {};
    if (returnUrl) orderMeta.return_url = returnUrl;
    if (notifyUrl) orderMeta.notify_url = notifyUrl;

    // Cashfree requires 10-digit phone (no country code prefix)
    const rawPhone = (user.mobile || '').replace(/\D/g, '');
    const customerPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;
    const customerEmail = user.email || (customerPhone + '@placeholder.in');

    let cfRes;
    try {
      cfRes = await axios.post(cf.baseUrl + '/orders', {
        order_id: cfOrderId, order_amount: totalAmount, order_currency: 'INR',
        customer_details: { customer_id: String(user._id), customer_name: user.full_name || 'Customer', customer_email: customerEmail, customer_phone: customerPhone },
        order_meta: orderMeta,
      }, { headers: cf.headers });
    } catch (cfErr) {
      console.error('Cashfree create order error:', cfErr.response?.status, JSON.stringify(cfErr.response?.data));
      await Payment.findByIdAndDelete(payment._id);
      const cfMsg = cfErr.response?.data?.message || cfErr.response?.data?.type || 'Cashfree gateway error';
      return res.status(502).json({ success: false, message: cfMsg });
    }

    const paymentSessionId = cfRes.data?.payment_session_id;
    await Payment.findByIdAndUpdate(payment._id, { cashfree_order_id: cfOrderId, payment_session_id: paymentSessionId });

    // Build checkout URL served by our own backend (loads Cashfree JS SDK)
    const paymentPath = '/api/v1/payments/checkout/' + String(payment._id);
    const paymentUrl = backendUrl ? (backendUrl + paymentPath) : paymentPath;

    res.json({
      success: true,
      data: {
        payment_id: String(payment._id),
        order_id: cfOrderId,
        payment_session_id: paymentSessionId,
        payment_url: paymentUrl,
        referral_discount_amount: referralDiscountAmount,
        payable_installment_amount: discountedInstallmentAmount,
        payable_total_amount: totalAmount,
      }
    });
  } catch (err) { next(err); }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { order_id, payment_id } = req.body;
    if (!order_id || !payment_id) return res.status(400).json({ success: false, message: 'order_id and payment_id required' });

    const payment = await Payment.findById(payment_id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.payment_status === 'success') return res.json({ success: true, message: 'Already verified', data: payment });

    const cf = getCashfree();
    const res2 = await axios.get(cf.baseUrl + '/orders/' + order_id, { headers: cf.headers });
    const orderStatus = res2.data?.order_status;

    if (orderStatus === 'PAID') {
      await Payment.findByIdAndUpdate(payment._id, { payment_status: 'success', payment_date: new Date(), transaction_id: res2.data?.cf_order_id || order_id });
      const updated = await Payment.findById(payment._id);
      await handlePaymentSuccess(updated);

      audit({
        userId: updated.user_id, action: 'payment_success',
        resourceType: 'payment', resourceId: String(updated._id),
        description: `Payment ₹${updated.amount} verified for order ${order_id}`,
        metadata: { amount: updated.amount, order_id, transaction_id: updated.transaction_id },
        ipAddress: getIp(req),
      });

      return res.json({ success: true, message: 'Payment verified', data: updated });
    }
    res.json({ success: false, message: 'Payment not completed', data: { order_status: orderStatus } });
  } catch (err) { next(err); }
};

exports.cashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY || '').update(timestamp + body).digest('base64');
    if (signature !== expected) return res.status(400).json({ message: 'Invalid signature' });

    const { data, type } = req.body;
    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = data?.order?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ cashfree_order_id: orderId });
        if (payment && payment.payment_status !== 'success') {
          await Payment.findByIdAndUpdate(payment._id, { payment_status: 'success', payment_date: new Date(), transaction_id: data?.payment?.cf_payment_id });
          const updated = await Payment.findById(payment._id);
          await handlePaymentSuccess(updated);
        }
      }
    }
    res.json({ status: 'ok' });
  } catch (err) { res.json({ status: 'ok' }); }
};

exports.getMyPayments = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const payments = await Payment.find({ user_id: userId })
      .populate('chit_group_id', 'group_name group_number')
      .sort({ created_at: -1 });
    const data = payments.map(p => ({ ...p.toObject(), id: p._id, chitGroup: p.chit_group_id, chit_group: p.chit_group_id }));
    const paid = data.filter(p => p.payment_status === 'success' || p.payment_status === 'paid');
    const upcoming = data.filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue');
    res.json({ success: true, data: { paid, upcoming, all: data } });
  } catch (err) { next(err); }
};

exports.getUpcomingPayments = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const now = new Date();
    const eligibleReferral = await getEligibleReferralForDiscount(userId);

    // Get user's active memberships
    const memberships = await ChitMember.find({ user_id: userId, is_active: true })
      .populate('chit_group_id', 'group_name group_number chit_value commencement_date duration_months monthly_installment');

    // Get all successful payments for this user
    const paidPayments = await Payment.find({ user_id: userId, payment_status: 'success' }).select('chit_group_id month_number amount total_amount');
    const paidMap = {};
    paidPayments.forEach(p => { paidMap[String(p.chit_group_id) + '-' + p.month_number] = p; });

    // Get auction dividends
    const groupIds = memberships.map(m => m.chit_group_id?._id).filter(Boolean);
    const auctions = await Auction.find({ chit_group_id: { $in: groupIds }, status: 'completed' }).select('chit_group_id month_number dividend_per_member');
    const dividendMap = {};
    auctions.forEach(a => {
      const nextMonth = (a.month_number || 0) + 1;
      const key = String(a.chit_group_id) + '-' + nextMonth;
      dividendMap[key] = (dividendMap[key] || 0) + (a.dividend_per_member || 0);
    });

    const schedule = [];

    // Tiered late fee calculation (fixed amounts per client spec)
    const calcLateFee = (baseAmount, daysOverdue) => {
      if (daysOverdue <= 0) return 0;
      if (daysOverdue <= 7) return 100;           // ₹100 for 1–7 days
      if (daysOverdue <= 30) return 400;          // ₹400 for 8–30 days
      if (daysOverdue <= 60) return 600;          // ₹600 for 31–60 days
      return Math.round(baseAmount * 0.03 * 100) / 100; // 3% for 60+ days
    };

    for (const m of memberships) {
      const g = m.chit_group_id;
      if (!g || !g.commencement_date || !g.duration_months) continue;
      const start = new Date(g.commencement_date);
      const monthlyAmount = g.monthly_installment || Math.round(g.chit_value / g.duration_months);

      for (let mo = 1; mo <= g.duration_months; mo++) {
        const key = String(g._id) + '-' + mo;
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (mo - 1));

        // Apply dividend reduction
        const dividend = dividendMap[key] || 0;
        const baseAmount = Math.max(0, monthlyAmount - dividend);

        if (paidMap[key]) {
          // Already paid — skip (shown in history tab)
          continue;
        }

        const isOverdue = dueDate < now;
        const daysOverdue = isOverdue ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
        const lateFee = calcLateFee(baseAmount, daysOverdue);
        const isFuture = dueDate > now && !isOverdue;

        // Determine if this is the current payable month (first unpaid month that's due)
        const isDueNow = !isFuture; // overdue or current month

        schedule.push({
          _id: null, id: null, virtual: true,
          chit_group_id: g._id, chitGroup: g, chit_group: g,
          month_number: mo, amount: baseAmount,
          late_fee: lateFee,
          total_amount: Math.round((baseAmount + lateFee) * 100) / 100,
          dividend_reduction: dividend,
          due_date: dueDate,
          payment_status: isOverdue ? 'overdue' : (isFuture ? 'upcoming' : 'pending'),
          days_overdue: daysOverdue,
          can_pay: isDueNow,
          is_future: isFuture,
          payment_number: null,
        });
      }
    }

    // Sort: overdue first, then pending (current), then future
    schedule.sort((a, b) => {
      const order = { overdue: 0, pending: 1, upcoming: 2 };
      const diff = (order[a.payment_status] || 9) - (order[b.payment_status] || 9);
      if (diff !== 0) return diff;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    // Preview referral benefit on the next payable installment only.
    if (eligibleReferral) {
      const idx = schedule.findIndex((p) => p.can_pay === true && p.is_future !== true);
      if (idx >= 0) {
        const benefit = Math.min(Number(eligibleReferral.bonus_amount || 100), Number(schedule[idx].amount || 0));
        if (benefit > 0) {
          schedule[idx].referral_discount_amount = benefit;
          schedule[idx].referral_discount_referral_id = String(eligibleReferral._id);
          schedule[idx].amount_before_referral_discount = schedule[idx].amount;
          schedule[idx].total_amount_before_referral_discount = schedule[idx].total_amount;
          schedule[idx].amount = Math.max(0, Number(schedule[idx].amount || 0) - benefit);
          schedule[idx].total_amount = Math.max(0, Number(schedule[idx].total_amount || 0) - benefit);
        }
      }
    }

    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
};

exports.getDuePayments = exports.getUpcomingPayments;

// ─── Cashfree Hosted Checkout Page (serves HTML with JS SDK) ─────────────────
exports.checkoutPage = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).send('<h1>Payment not found</h1>');
    const sessionId = payment.payment_session_id;
    const orderId = payment.cashfree_order_id;
    if (!sessionId) return res.status(400).send('<h1>Payment session expired. Please try again.</h1>');

    const isTest = process.env.CASHFREE_ENV !== 'PROD';
    const mode = isTest ? 'sandbox' : 'production';
    const backendUrl = getBackendBaseUrl(req);
    const returnUrl = backendUrl + '/api/v1/payments/checkout-return?order_id=' + orderId + '&payment_id=' + payment._id;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Secure Payment - Assure ChitFunds</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh}
.container{text-align:center;padding:40px 20px}.spinner{width:40px;height:40px;border:4px solid #e3f2fd;border-top:4px solid #1976D2;border-radius:50%;animation:spin 1s linear infinite;margin:20px auto}
@keyframes spin{to{transform:rotate(360deg)}}h2{color:#1976D2;margin-bottom:8px}p{color:#666;font-size:14px}.error{color:#d32f2f;margin-top:16px;display:none}
.btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#1976D2;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;text-decoration:none}
</style>
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
</head><body>
<div class="container">
  <div class="spinner" id="spinner"></div>
  <h2>Processing Payment</h2>
  <p>Redirecting to secure payment page...</p>
  <div class="error" id="error">Payment could not be initiated. <br><a class="btn" href="javascript:location.reload()">Try Again</a></div>
</div>
<script>
(async function() {
  try {
    const cashfree = await Cashfree({ mode: "${mode}" });
    const result = await cashfree.checkout({ paymentSessionId: "${sessionId}", returnUrl: "${returnUrl}", redirectTarget: "_self" });
    if (result.error) {
      document.getElementById('spinner').style.display='none';
      document.getElementById('error').style.display='block';
      console.error('Cashfree error:', result.error);
    }
    // Fallback: if still on this page after 8s, show manual redirect link
    setTimeout(function() {
      if (document.getElementById('spinner').style.display !== 'none') {
        document.getElementById('spinner').style.display='none';
        document.getElementById('error').innerHTML = 'Payment page taking too long. <br><a class="btn" href="https://payments.cashfree.com/order/#${sessionId}" target="_self">Open Payment Page</a>';
        document.getElementById('error').style.display='block';
      }
    }, 8000);
  } catch(e) {
    document.getElementById('spinner').style.display='none';
    document.getElementById('error').style.display='block';
    console.error('Checkout error:', e);
  }
})();
</script></body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

// ─── Checkout Return (Cashfree redirects here after payment) ─────────────────
exports.checkoutReturn = async (req, res, next) => {
  try {
    const { order_id, payment_id } = req.query;
    const payment = payment_id ? await Payment.findById(payment_id) : null;
    const status = payment?.payment_status || 'pending';

    // Auto-verify with Cashfree if still pending
    if (payment && order_id && status !== 'success') {
      try {
        const cf = getCashfree();
        const cfRes = await axios.get(cf.baseUrl + '/orders/' + order_id, { headers: cf.headers });
        if (cfRes.data?.order_status === 'PAID') {
          await Payment.findByIdAndUpdate(payment._id, { payment_status: 'success', payment_date: new Date(), transaction_id: cfRes.data.cf_order_id || order_id });
          const updated = await Payment.findById(payment._id);
          await handlePaymentSuccess(updated);
        }
      } catch (_) {}
    }

    const updatedPayment = payment_id ? await Payment.findById(payment_id) : null;
    const finalStatus = updatedPayment?.payment_status || status;
    const isSuccess = finalStatus === 'success';

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment ${isSuccess ? 'Successful' : 'Processing'}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:40px;text-align:center;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
.icon{font-size:64px;margin-bottom:16px}h2{margin-bottom:8px}p{color:#666;font-size:14px;margin-bottom:20px}
.btn{display:inline-block;padding:12px 32px;background:${isSuccess ? '#4CAF50' : '#1976D2'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style>
</head><body><div class="card">
<div class="icon">${isSuccess ? '✅' : '⏳'}</div>
<h2>${isSuccess ? 'Payment Successful!' : 'Payment Processing'}</h2>
<p>${isSuccess ? 'Your installment has been recorded. Thank you!' : 'Your payment is being processed. You can close this window.'}</p>
<a class="btn" href="javascript:void(0)" onclick="try{window.close()}catch(e){history.back()}">Done</a>
</div></body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

exports.getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};

exports.getAllPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, user_id, chit_group_id } = req.query;
    const filter = {};
    if (status) filter.payment_status = status;
    if (user_id) filter.user_id = user_id;
    if (chit_group_id) filter.chit_group_id = chit_group_id;
    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number')
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: { payments, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
};

exports.recordManualPayment = async (req, res, next) => {
  try {
    const { user_id, chit_group_id, month_number, amount, payment_method, notes } = req.body;
    const count = await Payment.countDocuments();
    const payment = await Payment.create({
      payment_number: 'PAY' + new Date().getFullYear() + String(count + 1).padStart(6, '0'),
      user_id, chit_group_id, month_number, payment_type: 'installment',
      amount: parseFloat(amount), total_amount: parseFloat(amount),
      payment_method: payment_method || 'cash', payment_gateway: 'Manual',
      payment_status: 'success', payment_date: new Date(), admin_notes: notes,
    });
    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (err) { next(err); }
};

exports.refundPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, { payment_status: 'refunded' }, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, message: 'Payment refunded', data: payment });
  } catch (err) { next(err); }
};

exports.downloadReceipt = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user_id', 'full_name mobile member_id email')
      .populate('chit_group_id', 'group_name group_number chit_value');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const user = payment.user_id || {};
    const group = payment.chit_group_id || {};
    const date = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const amt = Number(payment.total_amount || payment.amount || 0);
    const amountStr = '₹' + amt.toLocaleString('en-IN');
    const status = (payment.payment_status || 'pending').toUpperCase();
    const receiptNo = payment.payment_number || payment._id.toString();

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt_${receiptNo}.pdf"`,
    });
    doc.pipe(res);

    // Header background
    doc.rect(0, 0, doc.page.width, 120).fill('#1565C0');
    doc.fontSize(22).fill('#fff').text('Assure ChitFunds', 0, 35, { align: 'center' });
    doc.fontSize(12).fill('#ffffffcc').text('Payment Receipt', 0, 62, { align: 'center' });

    // Status badge
    const badgeColor = status === 'SUCCESS' ? '#4CAF50' : '#FF9800';
    const badgeW = 80, badgeH = 22;
    const badgeX = (doc.page.width - badgeW) / 2;
    doc.roundedRect(badgeX, 82, badgeW, badgeH, 11).fill(badgeColor);
    doc.fontSize(10).fill('#fff').text(status, badgeX, 87, { width: badgeW, align: 'center' });

    // Receipt body
    const startY = 150;
    const leftX = 60;
    const rightX = doc.page.width - 60;
    const rows = [
      ['Receipt No', receiptNo],
      ['Date', date],
      ['Member', user.full_name || 'N/A'],
      ['Member ID', user.member_id || 'N/A'],
      ['Chit Group', group.group_name || 'N/A'],
      ['Group No', group.group_number || 'N/A'],
      ['Payment Method', payment.payment_method || 'N/A'],
    ];
    if (payment.transaction_id) rows.push(['Transaction ID', payment.transaction_id]);

    let y = startY;
    for (const [label, value] of rows) {
      doc.fontSize(11).fill('#666').text(label, leftX, y);
      doc.fontSize(11).fill('#222').text(value, leftX, y, { width: rightX - leftX, align: 'right' });
      y += 28;
      doc.moveTo(leftX, y - 8).lineTo(rightX, y - 8).strokeColor('#f0f0f0').lineWidth(0.5).stroke();
    }

    // Amount row (highlighted)
    y += 5;
    doc.rect(leftX - 10, y - 5, rightX - leftX + 20, 40).fill('#f8f9fa');
    doc.fontSize(13).fill('#666').text('Amount Paid', leftX, y + 5);
    doc.fontSize(20).fill('#1565C0').text(amountStr, leftX, y + 2, { width: rightX - leftX, align: 'right' });
    y += 50;

    // Footer
    doc.fontSize(9).fill('#999').text('This is a computer-generated receipt. No signature required.', 0, y + 20, { align: 'center' });
    doc.text('Assure ChitFunds • assure.fund', 0, y + 34, { align: 'center' });

    doc.end();
  } catch (err) { next(err); }
};

exports.getAccountStatement = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('full_name mobile member_id email');
    const payments = await Payment.find({ user_id: userId, payment_status: 'success' })
      .populate('chit_group_id', 'group_name').sort({ payment_date: 1 });

    const format = req.query.format || 'csv';
    if (format === 'csv') {
      const csv = ['Date,Group,Amount,Payment#,Method', ...payments.map(p => [
        p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '',
        p.chit_group_id?.group_name || '',
        p.total_amount || p.amount || '',
        p.payment_number || '',
        p.payment_method || '',
      ].join(','))].join('\n');
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="statement.csv"');
      return res.send(csv);
    }

    // Server-side PDF generation
    if (format === 'pdf') {
      const totalPaid = payments.reduce((s, p) => s + (p.total_amount || p.amount || 0), 0);
      const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'attachment; filename="Assure_Statement.pdf"');
      doc.pipe(res);

      // Header
      doc.rect(0, 0, 615, 70).fill('#0D47A1');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('Assure ChitFunds', 40, 20);
      doc.fontSize(10).font('Helvetica').text('Account Statement', 40, 42);
      doc.fontSize(9).text(`Generated: ${now}`, 400, 28, { align: 'right', width: 175 });

      // User info
      let y = 85;
      doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold');
      doc.text('Account Holder: ', 40, y, { continued: true }).font('Helvetica').text(user?.full_name || 'N/A');
      doc.font('Helvetica-Bold').text('Member ID: ', 40, y + 16, { continued: true }).font('Helvetica').text(user?.member_id || 'N/A');
      doc.font('Helvetica-Bold').text('Mobile: ', 300, y + 16, { continued: true }).font('Helvetica').text(user?.mobile || 'N/A');

      // Summary
      y = 130;
      doc.rect(40, y, 515, 30).fill('#f0f4ff');
      doc.fillColor('#0D47A1').fontSize(10).font('Helvetica-Bold');
      doc.text(`Total Transactions: ${payments.length}`, 55, y + 9);
      doc.text(`Total Paid: Rs.${Number(totalPaid).toLocaleString('en-IN')}`, 350, y + 9);

      // Table header
      y = 175;
      const cols = [40, 120, 210, 320, 400, 480];
      const headers = ['Date', 'Receipt #', 'Chit Group', 'Method', 'Amount', 'Cumulative'];
      doc.rect(40, y, 515, 20).fill('#e8e8e8');
      doc.fillColor('#333333').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, cols[i] + 4, y + 6));

      // Table rows
      y += 20;
      let runBal = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#333333');
      for (const p of payments) {
        if (y > 760) { doc.addPage(); y = 40; }
        const amt = p.total_amount || p.amount || 0;
        runBal += amt;
        const date = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        if (payments.indexOf(p) % 2 === 0) doc.rect(40, y, 515, 18).fill('#f9f9f9');
        doc.fillColor('#333333');
        doc.text(date, cols[0] + 4, y + 5);
        doc.text(p.payment_number || '-', cols[1] + 4, y + 5);
        doc.text((p.chit_group_id?.group_name || '-').substring(0, 18), cols[2] + 4, y + 5);
        doc.text(p.payment_method || '-', cols[3] + 4, y + 5);
        doc.text(`Rs.${Number(amt).toLocaleString('en-IN')}`, cols[4] + 4, y + 5);
        doc.text(`Rs.${Number(runBal).toLocaleString('en-IN')}`, cols[5] + 4, y + 5);
        y += 18;
      }
      if (payments.length === 0) {
        doc.fillColor('#999999').fontSize(10).text('No transactions found', 200, y + 10);
      }

      // Footer
      y = Math.max(y + 20, 720);
      if (y > 760) { doc.addPage(); y = 40; }
      doc.fillColor('#999999').fontSize(8).text('This is a system-generated statement. For any discrepancies, please contact support.', 40, y, { align: 'center', width: 515 });
      doc.text('Assure ChitFunds - assure.fund', 40, y + 12, { align: 'center', width: 515 });

      doc.end();
      return;
    }

    // Bank-style HTML statement
    const totalPaid = payments.reduce((s, p) => s + (p.total_amount || p.amount || 0), 0);
    let runningBalance = 0;
    const rows = payments.map(p => {
      const amt = p.total_amount || p.amount || 0;
      runningBalance += amt;
      const date = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      return `<tr>
        <td>${date}</td>
        <td>${p.payment_number || '—'}</td>
        <td>${p.chit_group_id?.group_name || '—'}</td>
        <td>${p.payment_method || '—'}</td>
        <td class="amt">₹${Number(amt).toLocaleString('en-IN')}</td>
        <td class="amt">₹${Number(runningBalance).toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');

    const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Account Statement</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;padding:16px}
.stmt{max-width:800px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:18px;letter-spacing:0.5px}
.header .date{font-size:11px;opacity:0.8}
.info{display:flex;flex-wrap:wrap;gap:16px;padding:16px 24px;background:#f8f9ff;border-bottom:2px solid #1565C0}
.info div{font-size:13px;color:#333;min-width:120px}
.info .label{color:#888;font-size:11px;margin-bottom:2px}
.summary{display:flex;gap:16px;padding:16px 24px;background:#fafafa;border-bottom:1px solid #e0e0e0}
.summary .box{text-align:center;flex:1}
.summary .box .num{font-size:18px;font-weight:700;color:#1565C0}
.summary .box .lbl{font-size:11px;color:#666;margin-top:2px}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;min-width:500px}
th{background:#f5f5f5;padding:10px 12px;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #ddd;text-align:left}
td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f0f0f0}
tr:hover td{background:#f8f9ff}
.amt{text-align:right;font-family:'Courier New',monospace;font-weight:600}
.footer{text-align:center;padding:16px;background:#fafafa;font-size:10px;color:#999;border-top:2px solid #e0e0e0}
@media print{body{background:#fff;padding:0}.stmt{box-shadow:none;border-radius:0}th{background:#eee}}
</style></head><body>
<div class="stmt">
  <div class="header">
    <div><h1>Assure ChitFunds</h1><div class="date">Account Statement</div></div>
    <div style="text-align:right"><div class="date">Generated on</div><div style="font-size:14px">${now}</div></div>
  </div>
  <div class="info">
    <div><div class="label">Account Holder</div><strong>${user?.full_name || 'N/A'}</strong></div>
    <div><div class="label">Member ID</div><strong>${user?.member_id || 'N/A'}</strong></div>
    <div><div class="label">Mobile</div><strong>${user?.mobile || 'N/A'}</strong></div>
  </div>
  <div class="summary">
    <div class="box"><div class="num">${payments.length}</div><div class="lbl">Total Transactions</div></div>
    <div class="box"><div class="num">₹${Number(totalPaid).toLocaleString('en-IN')}</div><div class="lbl">Total Amount Paid</div></div>
  </div>
  <div class="table-wrap">
  <table>
    <thead><tr><th>Date</th><th>Receipt #</th><th>Chit Group</th><th>Method</th><th style="text-align:right">Amount</th><th style="text-align:right">Cumulative</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:#999">No transactions found</td></tr>'}</tbody>
  </table>
  </div>
  <div class="footer">
    This is a system-generated statement. For any discrepancies, please contact support.<br>
    Assure ChitFunds &bull; assure.fund
  </div>
</div>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

exports.calculateLateFee = async (req, res, next) => {
  try {
    const { payment_id, days_overdue } = req.body;
    const rate = 0.02;
    if (payment_id) {
      const payment = await Payment.findById(payment_id).populate('chit_group_id', 'monthly_installment');
      if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
      const base = payment.chit_group_id?.monthly_installment || payment.amount || 0;
      const fee = Math.round(base * rate * 100) / 100;
      return res.json({ success: true, data: { late_fee: fee, total_amount: base + fee } });
    }
    res.json({ success: true, data: { rate: rate * 100 + '%' } });
  } catch (err) { next(err); }
};
