const cron = require('node-cron');
const { Payment, User, ChitGroup, ChitMember } = require('../models');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

cron.schedule('30 3 * * *', async () => {
  logger.info('[Cron] Running payment reminder job...');
  try {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const upcoming = await Payment.find({
      payment_status: 'pending',
      due_date: { $gte: today, $lte: threeDaysLater },
    }).populate('user_id', 'full_name mobile email')
      .populate('chit_group_id', 'group_name');

    let sent = 0;
    for (const payment of upcoming) {
      const user = payment.user_id;
      if (!user?.mobile) continue;
      const dueDate = new Date(payment.due_date).toLocaleDateString('en-IN');
      const amount = parseFloat(payment.total_amount || payment.amount).toFixed(2);
      const groupName = payment.chit_group_id?.group_name || 'your group';
      const msg = 'Dear ' + user.full_name + ', your chit payment of Rs.' + amount + ' for ' + groupName + ' is due on ' + dueDate + '. Pay on time to avoid late fees. - Assure ChitFunds';
      try { await notificationService.sendSMS(user.mobile, msg); sent++; }
      catch (e) { logger.warn('[Cron] SMS failed for user ' + user._id + ': ' + e.message); }
    }
    logger.info('[Cron] Payment reminders sent: ' + sent + '/' + upcoming.length);
  } catch (err) { logger.error('[Cron] Payment reminder job failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });

cron.schedule('30 18 * * *', async () => {
  logger.info('[Cron] Running overdue check job...');
  try {
    const today = new Date();
    const overdue = await Payment.find({ payment_status: 'pending', due_date: { $lt: today }, late_fee: 0 })
      .populate('chit_group_id', 'monthly_installment');

    let updated = 0;
    const lateFeeRate = 0.02;
    for (const payment of overdue) {
      const installment = payment.chit_group_id?.monthly_installment || payment.amount || 0;
      const fee = Math.round(installment * lateFeeRate * 100) / 100;
      if (fee > 0) {
        await Payment.findByIdAndUpdate(payment._id, { late_fee: fee, total_amount: payment.amount + fee });
        updated++;
      }
    }
    logger.info('[Cron] Late fees applied: ' + updated + '/' + overdue.length);
  } catch (err) { logger.error('[Cron] Overdue check job failed:', err.message); }
}, { timezone: 'Asia/Kolkata' });

logger.info('[Cron] Scheduled jobs registered');
