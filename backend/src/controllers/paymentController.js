const { Payment, ChitGroup, ChitMember, User, Auction } = require('../models');
const axios = require('axios');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const getCashfree = () => {
  const isTest = process.env.CASHFREE_ENV !== 'PROD';
  return {
    baseUrl: isTest ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg',
    paymentPageUrl: isTest ? 'https://payments-test.cashfree.com/order/' : 'https://payments.cashfree.com/order/',
    headers: { 'x-api-version': '2023-08-01', 'x-client-id': process.env.CASHFREE_APP_ID || '', 'x-client-secret': process.env.CASHFREE_SECRET_KEY || '', 'Content-Type': 'application/json' },
  };
};

async function handlePaymentSuccess(payment) {
  try {
    const user = await User.findById(payment.user_id).select('full_name email mobile credit_score');
    if (!user) return;
    const newScore = Math.min(900, (user.credit_score || 650) + 10);
    await User.findByIdAndUpdate(user._id, { credit_score: newScore });
    if (user.mobile) {
      notificationService.sendSMS(user.mobile, 'Dear ' + user.full_name + ', your payment of ₹' + parseFloat(payment.total_amount || payment.amount).toFixed(2) + ' has been received. Ref: ' + payment.payment_number + ' - Assure ChitFunds').catch(() => {});
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

    const existing = await Payment.findOne({ chit_group_id, user_id: userId, month_number, payment_status: 'success' });
    if (existing) return res.status(400).json({ success: false, message: 'Month already paid' });

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
    const totalAmount = Math.round((parsedAmount + parsedLateFee) * 100) / 100;
    const payCount = await Payment.countDocuments();
    const paymentNumber = 'PAY' + new Date().getFullYear() + String(payCount + 1).padStart(6, '0');

    const payment = await Payment.create({
      payment_number: paymentNumber,
      user_id: userId,
      chit_group_id,
      month_number,
      payment_type,
      amount: parsedAmount,
      late_fee: parsedLateFee,
      total_amount: totalAmount,
      payment_method: 'online',
      payment_gateway: 'Cashfree',
      payment_status: 'pending',
      due_date: dueDate,
    });

    const cfOrderId = 'ACF-' + payment.payment_number + '-' + Date.now().toString(36).toUpperCase();
    const cf = getCashfree();
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const webUrl = process.env.WEB_CLIENT_URL || 'http://localhost:3000';
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || webUrl.includes('localhost');
    const notifyUrl = isLocalhost ? undefined : baseUrl + '/api/v1/payments/webhook/cashfree';

    // Cashfree PROD requires HTTPS return_url; skip for localhost
    const returnUrl = webUrl.startsWith('https://') ? (webUrl + '/payments?order_id=' + cfOrderId + '&payment_id=' + payment._id) : undefined;

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
    const paymentUrl = baseUrl + '/api/v1/payments/checkout/' + String(payment._id);

    res.json({ success: true, data: { payment_id: String(payment._id), order_id: cfOrderId, payment_session_id: paymentSessionId, payment_url: paymentUrl } });
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

    const LATE_FEE_RATE = 0.02; // 2% of installment
    const schedule = [];

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
        const lateFee = isOverdue ? Math.round(baseAmount * LATE_FEE_RATE * 100) / 100 : 0;
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
    const webUrl = process.env.WEB_CLIENT_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
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
    const result = await cashfree.checkout({ paymentSessionId: "${sessionId}", returnUrl: "${returnUrl}" });
    if (result.error) {
      document.getElementById('spinner').style.display='none';
      document.getElementById('error').style.display='block';
      console.error('Cashfree error:', result.error);
    }
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
    const amount = Number(payment.total_amount || payment.amount || 0).toLocaleString('en-IN');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;padding:20px}
.receipt{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#1565C0,#1976D2);color:#fff;padding:24px;text-align:center}
.header h1{font-size:20px;margin-bottom:4px}
.header p{font-size:12px;opacity:0.85}
.status{display:inline-block;margin-top:10px;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background:${payment.payment_status === 'success' ? 'rgba(76,175,80,0.2);color:#4CAF50' : 'rgba(255,152,0,0.2);color:#FF9800'}}
.body{padding:24px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0}
.row:last-child{border-bottom:none}
.label{color:#666;font-size:13px}
.value{font-weight:600;font-size:13px;text-align:right}
.amount-row{background:#f8f9fa;margin:16px -24px;padding:16px 24px;border-top:2px dashed #e0e0e0;border-bottom:2px dashed #e0e0e0}
.amount-row .value{font-size:20px;color:#1565C0}
.footer{text-align:center;padding:16px 24px;background:#fafafa;font-size:11px;color:#999}
@media print{body{background:#fff;padding:0}.receipt{box-shadow:none}}
</style></head><body>
<div class="receipt">
  <div class="header">
    <h1>Assure ChitFunds</h1>
    <p>Payment Receipt</p>
    <div class="status">${payment.payment_status}</div>
  </div>
  <div class="body">
    <div class="row"><span class="label">Receipt No</span><span class="value">${payment.payment_number || payment._id}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
    <div class="row"><span class="label">Member</span><span class="value">${user.full_name || 'N/A'}</span></div>
    <div class="row"><span class="label">Member ID</span><span class="value">${user.member_id || 'N/A'}</span></div>
    <div class="row"><span class="label">Chit Group</span><span class="value">${group.group_name || 'N/A'}</span></div>
    <div class="row"><span class="label">Group No</span><span class="value">${group.group_number || 'N/A'}</span></div>
    <div class="row"><span class="label">Payment Method</span><span class="value">${payment.payment_method || 'N/A'}</span></div>
    ${payment.transaction_id ? `<div class="row"><span class="label">Transaction ID</span><span class="value">${payment.transaction_id}</span></div>` : ''}
    <div class="row amount-row"><span class="label" style="font-size:15px">Amount Paid</span><span class="value">₹${amount}</span></div>
  </div>
  <div class="footer">
    This is a computer-generated receipt. No signature required.<br>
    Assure ChitFunds &bull; assure.fund
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Account Statement</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;padding:20px}
.stmt{max-width:800px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:22px;letter-spacing:0.5px}
.header .date{font-size:12px;opacity:0.8}
.info{display:flex;gap:40px;padding:20px 32px;background:#f8f9ff;border-bottom:2px solid #1565C0}
.info div{font-size:13px;color:#333}
.info .label{color:#888;font-size:11px;margin-bottom:2px}
.summary{display:flex;gap:32px;padding:16px 32px;background:#fafafa;border-bottom:1px solid #e0e0e0}
.summary .box{text-align:center;flex:1}
.summary .box .num{font-size:20px;font-weight:700;color:#1565C0}
.summary .box .lbl{font-size:11px;color:#666;margin-top:2px}
table{width:100%;border-collapse:collapse}
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
  <table>
    <thead><tr><th>Date</th><th>Receipt #</th><th>Chit Group</th><th>Method</th><th style="text-align:right">Amount</th><th style="text-align:right">Cumulative</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:#999">No transactions found</td></tr>'}</tbody>
  </table>
  <div class="footer">
    This is a system-generated statement. For any discrepancies, please contact support.<br>
    Assure ChitFunds &bull; assure.fund
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
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
