'use strict';

const cron = require('node-cron');
const { User, ChitGroup, ChitMember, Auction, Payment, Notification } = require('../models');
const { sendPushNotification, sendPushToMultiple } = require('../config/firebase');
const logger = require('../utils/logger');

// ─── Helper: create in-app notification + send FCM push ──────────────────────
async function pushToUser(userId, title, body, type = 'general', data = {}) {
  try {
    const notif = await Notification.create({
      user_id: userId, title, message: body, type, data, sent_at: new Date(),
      delivery_method: ['push', 'in_app'],
    });
    const user = await User.findById(userId).select('fcm_token').lean();
    if (user?.fcm_token) {
      const result = await sendPushNotification(user.fcm_token, title, body, {
        type, notification_id: String(notif._id), ...data,
      });
      if (result === 'INVALID_TOKEN') {
        await User.findByIdAndUpdate(userId, { $unset: { fcm_token: 1 } });
      }
      return result;
    }
  } catch (e) {
    logger.warn(`[PushAuto] pushToUser failed for ${userId}: ${e.message}`);
  }
  return null;
}

async function pushToMany(userIds, title, body, type = 'general', data = {}) {
  if (!userIds.length) return;
  try {
    const docs = userIds.map(uid => ({
      user_id: uid, title, message: body, type, data, sent_at: new Date(),
      delivery_method: ['push', 'in_app'],
    }));
    await Notification.insertMany(docs);

    const users = await User.find({ _id: { $in: userIds }, fcm_token: { $exists: true, $ne: null } })
      .select('fcm_token').lean();
    const tokens = users.map(u => u.fcm_token);
    if (tokens.length > 0) {
      const result = await sendPushToMultiple(tokens, title, body, { type, ...data });
      if (result.invalidTokens?.length > 0) {
        await User.updateMany(
          { fcm_token: { $in: result.invalidTokens } },
          { $unset: { fcm_token: 1 } }
        );
      }
      logger.info(`[PushAuto] pushToMany: ${result.successCount}/${tokens.length} delivered for "${title}"`);
    }
  } catch (e) {
    logger.warn(`[PushAuto] pushToMany failed: ${e.message}`);
  }
}

// Helper: check if notification was already sent today for this user+type
async function alreadySentToday(userId, type, extraMatch = {}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Notification.exists({
    user_id: userId,
    type,
    created_at: { $gte: todayStart },
    ...extraMatch,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. KYC DAILY REMINDER — 9:00 AM IST daily
//    Users with kyc_status != 'verified', active, with FCM token
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('0 9 * * *', async () => {
  logger.info('[PushAuto] Running KYC reminder job...');
  try {
    const users = await User.find({
      role: 'member', is_active: true,
      kyc_status: { $ne: 'verified' },
      fcm_token: { $exists: true, $ne: null },
    }).select('_id full_name kyc_status').lean();

    let sent = 0;
    for (const user of users) {
      if (await alreadySentToday(user._id, 'kyc_update')) continue;

      const name = user.full_name?.split(' ')[0] || 'there';
      const title = user.kyc_status === 'rejected'
        ? '🚫 KYC Rejected — Action Required'
        : '🔐 KYC Pending — Unlock Your Full Access';
      const body = user.kyc_status === 'rejected'
        ? `Hi ${name}, your KYC verification was rejected. Please re-submit your documents immediately to restore full access to bidding, auctions, and payouts. Tap to resolve now.`
        : `Hi ${name}, your KYC verification is still pending. Complete it in under 2 minutes to unlock auction bidding, prize eligibility, and dividend payouts — don't miss your next auction!`;

      await pushToUser(user._id, title, body, 'kyc_update', { screen: 'kyc' });
      sent++;
    }
    logger.info(`[PushAuto] KYC reminders sent: ${sent}/${users.length}`);
  } catch (err) {
    logger.error('[PushAuto] KYC reminder failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PAYMENT DUE REMINDERS — 8:30 AM IST daily
//    3 days before → 1 day before → on due date
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('30 8 * * *', async () => {
  logger.info('[PushAuto] Running payment due reminder job...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeDays = new Date(today); threeDays.setDate(today.getDate() + 3);
    const oneDay = new Date(today); oneDay.setDate(today.getDate() + 1);
    const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

    const pending = await Payment.find({
      payment_status: 'pending',
      due_date: { $gte: today, $lte: threeDays },
    }).populate('user_id', '_id full_name fcm_token')
      .populate('chit_group_id', 'group_name')
      .lean();

    let sent = 0;
    for (const p of pending) {
      if (!p.user_id?._id) continue;
      if (await alreadySentToday(p.user_id._id, 'payment_reminder')) continue;

      const dueDate = new Date(p.due_date);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      const groupName = p.chit_group_id?.group_name || 'your chit group';
      const amount = `₹${parseFloat(p.total_amount || p.amount || 0).toLocaleString('en-IN')}`;
      const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      let title, body;
      if (diffDays <= 0) {
        title = '🚨 Payment Due Today — Act Now!';
        body = `Your installment of ${amount} for ${groupName} is due TODAY (${dueDateStr}). Pay immediately to avoid late fees and protect your bidding rights. Tap to pay now.`;
      } else if (diffDays === 1) {
        title = '⏰ Last Reminder: Payment Due Tomorrow';
        body = `Don't forget! Your installment of ${amount} for ${groupName} is due tomorrow (${dueDateStr}). Pay today to stay on track and avoid any late penalty. Tap to pay now.`;
      } else {
        title = '📅 Upcoming Installment — Plan Ahead';
        body = `Hi! Your installment of ${amount} for ${groupName} is due on ${dueDateStr}. Early payment ensures uninterrupted auction eligibility and a cleaner payment record.`;
      }

      await pushToUser(p.user_id._id, title, body, 'payment_reminder', {
        screen: 'payments', payment_id: String(p._id),
      });
      sent++;
    }
    logger.info(`[PushAuto] Payment due reminders sent: ${sent}/${pending.length}`);
  } catch (err) {
    logger.error('[PushAuto] Payment due reminder failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 3. OVERDUE PAYMENT ALERTS — 6:30 PM IST daily
//    Payments past due date that aren't paid yet
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('30 18 * * *', async () => {
  logger.info('[PushAuto] Running overdue payment alert job...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await Payment.find({
      payment_status: 'pending',
      due_date: { $lt: today },
    }).populate('user_id', '_id full_name fcm_token')
      .populate('chit_group_id', 'group_name')
      .lean();

    let sent = 0;
    for (const p of overdue) {
      if (!p.user_id?._id) continue;
      if (await alreadySentToday(p.user_id._id, 'payment_reminder')) continue;

      const daysOverdue = Math.floor((today - new Date(p.due_date)) / (1000 * 60 * 60 * 24));
      const groupName = p.chit_group_id?.group_name || 'your chit group';
      const amount = `₹${parseFloat(p.total_amount || p.amount || 0).toLocaleString('en-IN')}`;

      let title, body;
      if (daysOverdue >= 14) {
        title = '🔴 Critical: Payment Severely Overdue';
        body = `Your installment of ${amount} for ${groupName} is ${daysOverdue} days overdue. Continued default may result in loss of auction rights, credit bureau reporting, and legal recovery proceedings. Pay immediately to avoid escalation.`;
      } else if (daysOverdue >= 7) {
        title = '⚠️ Overdue Alert — Late Fees Applying';
        body = `Your installment of ${amount} for ${groupName} is ${daysOverdue} days past due. Late fees are accumulating daily. Pay now to stop the penalty clock and protect your membership standing.`;
      } else {
        title = '❗ Missed Payment — Pay to Avoid Penalty';
        body = `Your installment of ${amount} for ${groupName} was due ${daysOverdue} day(s) ago. Please clear this immediately to avoid late fees and maintain your good standing. Tap to pay now.`;
      }

      await pushToUser(p.user_id._id, title, body, 'payment_reminder', {
        screen: 'payments', payment_id: String(p._id),
      });
      sent++;
    }
    logger.info(`[PushAuto] Overdue alerts sent: ${sent}/${overdue.length}`);
  } catch (err) {
    logger.error('[PushAuto] Overdue alert failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AUCTION REMINDERS — Runs every 30 minutes to catch upcoming auctions
//    1 day before, 1 hour before
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('*/30 * * * *', async () => {
  try {
    const now = new Date();
    const oneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneDayMinus30 = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 30 * 60 * 1000);
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourMinus30 = new Date(now.getTime() + 60 * 60 * 1000 - 30 * 60 * 1000);

    // 1-day-before auctions
    const dayBefore = await Auction.find({
      status: 'scheduled',
      auction_date: { $gte: oneDayMinus30, $lte: oneDay },
    }).populate('chit_group_id', 'group_name').lean();

    for (const auction of dayBefore) {
      const groupName = auction.chit_group_id?.group_name || 'your chit group';
      const dateStr = new Date(auction.auction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      const members = await ChitMember.find({
        chit_group_id: auction.chit_group_id._id || auction.chit_group_id,
        is_active: true,
      }).select('user_id').lean();
      const userIds = members.map(m => m.user_id);

      // Check if already notified (use title as dedup key)
      const alreadySent = await Notification.exists({
        type: 'auction_alert',
        title: /Auction Tomorrow/,
        'data.auction_id': String(auction._id),
      });
      if (alreadySent) continue;

      await pushToMany(userIds,
        `🏦 Auction Tomorrow: ${groupName}`,
        `Month ${auction.month_number} auction for ${groupName} is tomorrow (${dateStr}). Prepare your bid strategy — bid smart to maximize your savings and get the best prize amount!`,
        'auction_alert',
        { screen: 'auctions', auction_id: String(auction._id) }
      );
    }

    // 1-hour-before auctions
    const hourBefore = await Auction.find({
      status: 'scheduled',
      auction_date: { $gte: oneHourMinus30, $lte: oneHour },
    }).populate('chit_group_id', 'group_name').lean();

    for (const auction of hourBefore) {
      const groupName = auction.chit_group_id?.group_name || 'your chit group';

      const alreadySent = await Notification.exists({
        type: 'auction_alert',
        title: /Auction Starting Soon/,
        'data.auction_id': String(auction._id),
      });
      if (alreadySent) continue;

      const members = await ChitMember.find({
        chit_group_id: auction.chit_group_id._id || auction.chit_group_id,
        is_active: true,
      }).select('user_id').lean();
      const userIds = members.map(m => m.user_id);

      await pushToMany(userIds,
        `⏱️ Auction in 1 Hour — ${groupName}`,
        `The Month ${auction.month_number} auction for ${groupName} starts in approximately 1 hour. Open the app now, review your bid limit, and get ready to win!`,
        'auction_alert',
        { screen: 'auction_room', auction_id: String(auction._id) }
      );
    }
  } catch (err) {
    logger.error('[PushAuto] Auction reminder failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AUCTION RESULT NOTIFICATIONS — every 5 minutes, check recently completed
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('*/5 * * * *', async () => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const completed = await Auction.find({
      status: 'completed',
      updated_at: { $gte: fiveMinAgo },
    }).populate('chit_group_id', 'group_name')
      .populate('winner_id', 'full_name')
      .lean();

    for (const auction of completed) {
      // Dedup
      const alreadySent = await Notification.exists({
        type: 'auction_result',
        'data.auction_id': String(auction._id),
        title: /Auction Results/,
      });
      if (alreadySent) continue;

      const groupName = auction.chit_group_id?.group_name || 'Chit Group';
      const winnerName = auction.winner_id?.full_name || 'a member';
      const dividend = auction.dividend_per_member
        ? `₹${auction.dividend_per_member.toLocaleString('en-IN')}`
        : '';

      // Notify all group members
      const members = await ChitMember.find({
        chit_group_id: auction.chit_group_id._id || auction.chit_group_id,
        is_active: true,
      }).select('user_id').lean();

      const allUserIds = members.map(m => m.user_id);
      const nonWinnerIds = allUserIds.filter(uid =>
        String(uid) !== String(auction.winner_id?._id)
      );

      // Notify winner
      if (auction.winner_id?._id) {
        const prizeAmt = auction.disbursement_amount
          ? `₹${auction.disbursement_amount.toLocaleString('en-IN')}`
          : '';
        await pushToUser(auction.winner_id._id,
          `🎉 You Won! — ${groupName} Month ${auction.month_number}`,
          `Congratulations! You won the Month ${auction.month_number} auction for ${groupName}. ${prizeAmt ? `Prize Amount: ${prizeAmt} — this will be disbursed to your registered bank account shortly.` : 'Your prize disbursement is being processed. You will receive a confirmation soon.'} Thank you for being a valued member!`,
          'auction_result',
          { screen: 'auction_result', auction_id: String(auction._id) }
        );
      }

      // Notify others
      if (nonWinnerIds.length > 0) {
        await pushToMany(nonWinnerIds,
          `🏆 Month ${auction.month_number} Auction Results — ${groupName}`,
          `The Month ${auction.month_number} auction for ${groupName} has concluded. ${winnerName} is the winner. ${dividend ? `Your dividend credit for this month: ${dividend} — automatically adjusted in your next installment.` : 'Dividend details will be updated in the app shortly.'} Stay active for next month's auction!`,
          'auction_result',
          { screen: 'auction_result', auction_id: String(auction._id) }
        );
      }
    }
  } catch (err) {
    logger.error('[PushAuto] Auction result notification failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MONTHLY INSTALLMENT REMINDER — 25th of each month at 10 AM
//    Reminds all active group members about next month's payment
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('0 10 25 * *', async () => {
  logger.info('[PushAuto] Running monthly installment heads-up...');
  try {
    const activeGroups = await ChitGroup.find({ status: 'active' }).lean();

    for (const group of activeGroups) {
      const members = await ChitMember.find({
        chit_group_id: group._id, is_active: true,
      }).select('user_id').lean();
      const userIds = members.map(m => m.user_id);

      const installment = `₹${group.monthly_installment?.toLocaleString('en-IN') || '0'}`;

      await pushToMany(userIds,
        `� Next Installment Coming Up — ${group.group_name}`,
        `A heads-up! Your monthly installment of ${installment} for ${group.group_name} is due next month. Setting aside funds today ensures timely payment, preserves your auction eligibility, and keeps your financial record clean.`,
        'payment_reminder',
        { screen: 'payments', group_id: String(group._id) }
      );
    }
    logger.info(`[PushAuto] Monthly heads-up sent for ${activeGroups.length} groups`);
  } catch (err) {
    logger.error('[PushAuto] Monthly installment reminder failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PROFILE COMPLETION NUDGE — Tuesdays & Fridays at 11 AM
//    Users missing address/PAN/bank details
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('0 11 * * 2,5', async () => {
  logger.info('[PushAuto] Running profile completion nudge...');
  try {
    const users = await User.find({
      role: 'member', is_active: true,
      fcm_token: { $exists: true, $ne: null },
      $or: [
        { pan_number: { $exists: false } },
        { pan_number: null },
        { pan_number: '' },
        { bank_account_number: { $exists: false } },
        { bank_account_number: null },
        { bank_account_number: '' },
        { address: { $exists: false } },
        { address: null },
        { address: '' },
      ],
    }).select('_id full_name pan_number bank_account_number address').lean();

    let sent = 0;
    for (const user of users) {
      if (await alreadySentToday(user._id, 'general')) continue;

      const missing = [];
      if (!user.pan_number) missing.push('PAN');
      if (!user.bank_account_number) missing.push('Bank Account');
      if (!user.address) missing.push('Address');

      const firstName = user.full_name?.split(' ')[0] || 'there';
      await pushToUser(user._id,
        '👤 Profile Incomplete — Update Now',
        `Hi ${firstName}, your profile is missing: ${missing.join(', ')}. A complete profile is required for prize disbursals, audit compliance, and faster support. Takes less than 2 minutes — tap to update!`,
        'general',
        { screen: 'profile' }
      );
      sent++;
    }
    logger.info(`[PushAuto] Profile nudges sent: ${sent}/${users.length}`);
  } catch (err) {
    logger.error('[PushAuto] Profile completion nudge failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 8. INACTIVITY NUDGE — Sundays at 5 PM
//    Users who haven't logged in for 7+ days
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('0 17 * * 0', async () => {
  logger.info('[PushAuto] Running inactivity nudge...');
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const users = await User.find({
      role: 'member', is_active: true,
      fcm_token: { $exists: true, $ne: null },
      $or: [
        { last_login_at: { $lt: sevenDaysAgo } },
        { last_login_at: { $exists: false } },
      ],
    }).select('_id full_name').lean();

    const messages = [
      { title: '� Stay on Top of Your Chit Groups', body: name => `Hi ${name}, it's been a while since your last visit. Check upcoming auctions, pending payments, and your latest dividend credits — don't let anything slip by!` },
      { title: '💸 Your Chit Journey Awaits', body: name => `Hi ${name}, your chit groups may have new updates, dividend credits, or upcoming auctions. Log in now to stay in control of your savings plan.` },
      { title: '🔔 Don’t Miss Your Next Auction', body: name => `Hi ${name}, auctions are your opportunity to win the prize and reduce your effective cost. Check the app now to ensure you’re prepared for the next bid round!` },
    ];

    let sent = 0;
    for (const user of users) {
      if (await alreadySentToday(user._id, 'general')) continue;

      const msg = messages[sent % messages.length]; // Rotate messages
      await pushToUser(user._id,
        msg.title,
        msg.body(user.full_name || 'there'),
        'general',
        { screen: 'dashboard' }
      );
      sent++;
    }
    logger.info(`[PushAuto] Inactivity nudges sent: ${sent}/${users.length}`);
  } catch (err) {
    logger.error('[PushAuto] Inactivity nudge failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PAYMENT RECEIVED THANK YOU — every 10 minutes, check recent paid payments
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('*/10 * * * *', async () => {
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentPaid = await Payment.find({
      payment_status: 'paid',
      payment_date: { $gte: tenMinAgo },
    }).populate('user_id', '_id full_name')
      .populate('chit_group_id', 'group_name')
      .lean();

    for (const p of recentPaid) {
      if (!p.user_id?._id) continue;
      // Dedup by payment_id
      const alreadySent = await Notification.exists({
        user_id: p.user_id._id,
        type: 'payment_received',
        'data.payment_id': String(p._id),
      });
      if (alreadySent) continue;

      const amount = `₹${parseFloat(p.total_amount || p.amount || 0).toLocaleString('en-IN')}`;
      const groupName = p.chit_group_id?.group_name || 'Chit Group';

      await pushToUser(p.user_id._id,
        '✅ Payment Confirmed — Thank You!',
        `Your installment of ${amount} for ${groupName} has been successfully received and recorded. Your payment record is up to date. Keep it up and earn a strong savings track record!`,
        'payment_received',
        { screen: 'payments', payment_id: String(p._id) }
      );
    }
  } catch (err) {
    logger.error('[PushAuto] Payment received notification failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 10. NEW GROUP ANNOUNCEMENT — every 15 minutes, check recently created groups
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('*/15 * * * *', async () => {
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const newGroups = await ChitGroup.find({
      status: 'active',
      created_at: { $gte: fifteenMinAgo },
    }).lean();

    for (const group of newGroups) {
      const alreadySent = await Notification.exists({
        type: 'promotional',
        title: /New Chit Group/,
        'data.group_id': String(group._id),
      });
      if (alreadySent) continue;

      const allMembers = await User.find({
        role: 'member', is_active: true,
        fcm_token: { $exists: true, $ne: null },
      }).select('_id').lean();

      const chitValue = `₹${group.chit_value?.toLocaleString('en-IN') || '0'}`;
      const installment = `₹${group.monthly_installment?.toLocaleString('en-IN') || '0'}`;

      await pushToMany(allMembers.map(u => u._id),
        `� New Chit Group Open: ${group.group_name}`,
        `A new chit group is now accepting enrollments! Chit Value: ${chitValue} | Monthly Installment: ${installment} | Duration: ${group.duration_months} months. Seats are limited — secure your spot before it fills up!`,
        'promotional',
        { screen: 'chit_groups', group_id: String(group._id) }
      );
    }
  } catch (err) {
    logger.error('[PushAuto] New group announcement failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 11. DIVIDEND CREDITED — every 10 minutes, watch for new wallet credits
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('*/10 * * * *', async () => {
  try {
    const { WalletTransaction } = require('../models');
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    const recent = await WalletTransaction.find({
      type: 'dividend',
      created_at: { $gte: tenMinAgo },
    }).lean();

    for (const txn of recent) {
      const alreadySent = await Notification.exists({
        user_id: txn.user_id,
        type: 'dividend_credit',
        'data.txn_id': String(txn._id),
      });
      if (alreadySent) continue;

      const amount = `₹${txn.amount?.toLocaleString('en-IN') || '0'}`;
      await pushToUser(txn.user_id,
        '� Dividend Credited to Your Account!',
        `Great news! A dividend of ${amount} has been credited to your Assure ChitFunds wallet. Current balance: ₹${txn.balance_after?.toLocaleString('en-IN') || '0'}. This will be applied towards your upcoming installment automatically.`,
        'dividend_credit',
        { screen: 'wallet', txn_id: String(txn._id) }
      );
    }
  } catch (err) {
    logger.error('[PushAuto] Dividend notification failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ═══════════════════════════════════════════════════════════════════════════════
// 12. GOOD MORNING ENGAGEMENT — 8 AM IST on Mondays
//     Send a positive message to all active members with tokens
// ═══════════════════════════════════════════════════════════════════════════════
cron.schedule('0 8 * * 1', async () => {
  logger.info('[PushAuto] Running Monday engagement push...');
  try {
    const users = await User.find({
      role: 'member', is_active: true,
      fcm_token: { $exists: true, $ne: null },
    }).select('_id').lean();

    const tips = [
      '💡 Tip: Pay your installments on time to boost your credit score and unlock better loan options!',
      '💡 Tip: Refer friends to earn ₹500 per referral! Share your code from the Referrals section.',
      '💡 Tip: Completed your KYC? You can now participate in auctions and earn dividends!',
      '💡 Tip: Check your payment history to track all installments and dividend credits.',
    ];
    const tip = tips[new Date().getDate() % tips.length];

    await pushToMany(users.map(u => u._id),
      '🌟 Good Morning from Assure ChitFunds!',
      `Start your week strong! ${tip}`,
      'general',
      { screen: 'dashboard' }
    );
    logger.info(`[PushAuto] Monday engagement sent to ${users.length} users`);
  } catch (err) {
    logger.error('[PushAuto] Monday engagement failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

logger.info('[PushAuto] ✅ All automated push notification jobs registered');
logger.info('[PushAuto] Schedule: KYC(9AM) | PayDue(8:30AM) | Overdue(6:30PM) | Auctions(every 30m) | Results(every 5m) | Monthly(25th 10AM) | Profile(Tue/Fri 11AM) | Inactivity(Sun 5PM) | PayReceipt(every 10m) | NewGroup(every 15m) | Dividend(every 10m) | Monday(8AM)');

module.exports = { pushToUser, pushToMany };
