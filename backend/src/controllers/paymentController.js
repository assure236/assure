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

    const [user, group] = await Promise.all([
      User.findById(userId).select('full_name email mobile member_id'),
      ChitGroup.findById(chit_group_id).select('group_name group_number commencement_date duration_months'),
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
    await Payment.findByIdAndUpdate(payment._id, { cashfree_order_id: cfOrderId });
    const paymentUrl = cf.paymentPageUrl + cfOrderId;

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

    // 1. Get existing pending/overdue Payment documents
    const payments = await Payment.find({ user_id: userId, payment_status: { $in: ['pending', 'overdue'] } })
      .populate('chit_group_id', 'group_name group_number chit_value commencement_date duration_months')
      .sort({ due_date: 1 });
    const now = new Date();
    const existingData = payments.map(p => {
      const isOverdue = p.due_date && new Date(p.due_date) < now;
      const daysOverdue = isOverdue ? Math.floor((now - new Date(p.due_date)) / (1000 * 60 * 60 * 24)) : 0;
      return { ...p.toObject(), id: p._id, chitGroup: p.chit_group_id, chit_group: p.chit_group_id, payment_status: isOverdue ? 'overdue' : 'pending', days_overdue: daysOverdue };
    });

    // 2. Generate virtual entries from payment schedule for all enrolled groups
    const memberships = await ChitMember.find({ user_id: userId, is_active: true }).populate('chit_group_id', 'group_name group_number chit_value commencement_date duration_months');
    const paidPayments = await Payment.find({ user_id: userId, payment_status: 'success' }).select('chit_group_id month_number');
    const paidMap = {};
    paidPayments.forEach(p => { paidMap[String(p.chit_group_id) + '-' + p.month_number] = true; });

    // Also track months already in existingData
    const pendingMap = {};
    existingData.forEach(p => { pendingMap[String(p.chit_group_id?._id || p.chit_group_id) + '-' + p.month_number] = true; });

    const virtualEntries = [];
    for (const m of memberships) {
      const g = m.chit_group_id;
      if (!g || !g.commencement_date || !g.duration_months) continue;
      const start = new Date(g.commencement_date);
      const monthlyAmount = Math.round(g.chit_value / g.duration_months);

      // Find the first unpaid month (sequential)
      for (let mo = 1; mo <= g.duration_months; mo++) {
        const key = String(g._id) + '-' + mo;
        if (paidMap[key]) continue; // already paid
        if (pendingMap[key]) break; // already in pending list, stop
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (mo - 1));
        const isOverdue = dueDate < now;
        const daysOverdue = isOverdue ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
        if (!isOverdue && mo > 1) break; // only show current/overdue month as upcoming
        virtualEntries.push({
          _id: null, id: null, virtual: true,
          chit_group_id: g._id, chitGroup: g, chit_group: g,
          month_number: mo, amount: monthlyAmount, total_amount: monthlyAmount, late_fee: 0,
          due_date: dueDate, payment_status: isOverdue ? 'overdue' : 'pending',
          days_overdue: daysOverdue, can_pay: true,
        });
        break; // only the first unpaid month per group (sequential)
      }
    }

    const allData = [...existingData, ...virtualEntries].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    res.json({ success: true, data: allData });
  } catch (err) { next(err); }
};

exports.getDuePayments = exports.getUpcomingPayments;

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
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name group_number');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    const html = '<html><body><h2>Payment Receipt</h2><p>Payment #: ' + payment.payment_number + '</p><p>Amount: ₹' + payment.total_amount + '</p><p>Date: ' + (payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : 'N/A') + '</p><p>Status: ' + payment.payment_status + '</p></body></html>';
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

exports.getAccountStatement = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const payments = await Payment.find({ user_id: userId, payment_status: 'success' })
      .populate('chit_group_id', 'group_name').sort({ payment_date: -1 });
    const csv = ['Date,Group,Amount,Payment#,Method', ...payments.map(p => [
      p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '',
      p.chit_group_id?.group_name || '',
      p.total_amount || p.amount || '',
      p.payment_number || '',
      p.payment_method || '',
    ].join(','))].join('\n');
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="statement.csv"');
    res.send(csv);
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
