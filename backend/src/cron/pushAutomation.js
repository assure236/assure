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

      const title = '📋 Complete Your KYC Verification';
      const body = user.kyc_status === 'rejected'
        ? `Hi ${user.full_name || 'there'}, your KYC was rejected. Please re-submit your documents to continue using all features.`
        : `Hi ${user.full_name || 'there'}, your KYC is pending. Complete it now to unlock bidding, payments, and dividends!`;

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
        title = '🚨 Payment Due Today!';
        body = `Your installment of ${amount} for ${groupName} is due TODAY (${dueDateStr}). Pay now to avoid late fees!`;
      } else if (diffDays === 1) {
        title = '⏰ Payment Due Tomorrow';
        body = `Reminder: ${amount} for ${groupName} is due tomorrow (${dueDateStr}). Make your payment today!`;
      } else {
        title = '📅 Upcoming Payment Reminder';
        body = `Your installment of ${amount} for ${groupName} is due on ${dueDateStr}. Plan your payment in advance!`;
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
        title = '🔴 Urgent: Payment Severely Overdue';
        body = `Your payment of ${amount} for ${groupName} is ${daysOverdue} days overdue! Late fees are accumulating. Pay immediately to avoid legal action.`;
      } else if (daysOverdue >= 7) {
        title = '⚠️ Payment Overdue — Action Required';
        body = `Your installment of ${amount} for ${groupName} is ${daysOverdue} days overdue. A late fee has been applied. Pay now to avoid further penalties.`;
      } else {
        title = '❗ Payment Overdue';
        body = `Your payment of ${amount} for ${groupName} is ${daysOverdue} day(s) overdue. Please pay at the earliest to avoid late fees.`;
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
        '📅 Auction Tomorrow!',
        `The auction for ${groupName} (Month ${auction.month_number}) is scheduled for ${dateStr}. Get ready to bid!`,
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
        '🔴 Auction Starting Soon!',
        `The auction for ${groupName} starts in about 1 hour! Open the app and get ready to bid.`,
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
          '🎉 Congratulations — You Won the Auction!',
          `You won the Month ${auction.month_number} auction for ${groupName}! ${prizeAmt ? `Prize: ${prizeAmt}` : 'Your prize will be disbursed soon.'}`,
          'auction_result',
          { screen: 'auction_result', auction_id: String(auction._id) }
        );
      }

      // Notify others
      if (nonWinnerIds.length > 0) {
        await pushToMany(nonWinnerIds,
          '🏆 Auction Results Are Out!',
          `The Month ${auction.month_number} auction for ${groupName} is complete. Winner: ${winnerName}. ${dividend ? `Your dividend: ${dividend}.` : ''} Check the app for details.`,
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
        `📊 ${group.group_name} — Next Month Installment`,
        `Your monthly installment of ${installment} for ${group.group_name} is coming up. Plan your finances and pay on time to earn better credit scores!`,
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

      await pushToUser(user._id,
        '👤 Complete Your Profile',
        `Hi ${user.full_name || 'there'}, please update your ${missing.join(', ')} details for smooth disbursals and better service.`,
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
      { title: '👋 We Miss You!', body: name => `Hi ${name}, it's been a while! Check your chit group updates, payment status, and upcoming auctions.` },
      { title: '📱 Don\'t Miss Out!', body: name => `Hi ${name}, there may be new updates in your chit groups. Open the app to stay informed!` },
      { title: '🔔 Quick Check-In', body: name => `Hi ${name}, your chit group may have new dividends or auction updates. Take a quick look!` },
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
        '✅ Payment Received — Thank You!',
        `Your payment of ${amount} for ${groupName} has been received. Keep up the great track record! 🌟`,
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
        `🆕 New Group: ${group.group_name}`,
        `A new chit group is now open! Value: ${chitValue}, Monthly: ${installment}, Duration: ${group.duration_months} months. Limited slots — join now!`,
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
        '💸 Dividend Credited!',
        `Great news! ${amount} dividend has been credited to your wallet. Your new balance: ₹${txn.balance_after?.toLocaleString('en-IN') || '0'}.`,
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
