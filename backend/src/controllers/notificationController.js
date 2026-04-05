const { Notification, User, CommunicationLog } = require('../models');
const { sendPushNotification, sendPushToMultiple } = require('../config/firebase');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const filter = { user_id: req.user._id || req.user.id };
    if (unread === 'true') filter.is_read = false;
    const total = await Notification.countDocuments(filter);
    const rows = await Notification.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, data: { notifications: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id || req.user.id },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) { next(err); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user_id: req.user._id || req.user.id, is_read: false },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

exports.markAsUnread = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id || req.user.id },
      { is_read: false, $unset: { read_at: 1 } }
    );
    res.json({ success: true, message: 'Notification marked as unread' });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user._id || req.user.id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
};

// Create notification for a specific user (admin use)
exports.sendNotification = async (req, res, next) => {
  try {
    const { user_id, title, message, type = 'general', data } = req.body;
    if (!user_id || !title || !message) {
      return res.status(400).json({ success: false, message: 'user_id, title, message required' });
    }
    // Dedup: skip if same notification sent to this user within last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await Notification.findOne({
      user_id, title, message, created_at: { $gte: oneHourAgo },
    });
    if (existing) {
      return res.status(200).json({ success: true, data: existing, deduplicated: true });
    }

    const notification = await Notification.create({ user_id, title, message, type, data, sent_at: new Date() });

    // Send FCM push notification
    const targetUser = await User.findById(user_id).select('fcm_token');
    let pushStatus = 'sent';
    if (targetUser?.fcm_token) {
      const result = await sendPushNotification(targetUser.fcm_token, title, message, { type, notification_id: notification._id.toString() });
      if (result === 'INVALID_TOKEN') {
        await User.findByIdAndUpdate(user_id, { $unset: { fcm_token: 1 } });
        pushStatus = 'failed';
      } else if (!result) {
        pushStatus = 'failed';
      }
    } else {
      pushStatus = 'no_token';
    }

    // Log to CommunicationLog for history tracking
    try {
      await CommunicationLog.create({
        user_id, channel: 'push', type: type || 'general', subject: title, message,
        status: pushStatus, sent_by: req.user._id || req.user.id,
        recipient_type: 'individual', sent_at: new Date(),
      });
    } catch (_) {}

    res.status(201).json({ success: true, data: notification });
  } catch (err) { next(err); }
};

// Create notification for all users (admin broadcast)
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type = 'general', data } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title, message required' });
    }
    const users = await User.find({ role: 'member', is_active: true }).select('_id fcm_token');
    const docs = users.map(u => ({ user_id: u._id, title, message, type, data, sent_at: new Date() }));
    await Notification.insertMany(docs);

    // Send FCM push to all users with tokens
    const fcmTokens = users.filter(u => u.fcm_token).map(u => u.fcm_token);
    let pushResult = { successCount: 0, failureCount: 0 };
    if (fcmTokens.length > 0) {
      pushResult = await sendPushToMultiple(fcmTokens, title, message, { type });
      // Clean up invalid tokens
      if (pushResult.invalidTokens?.length > 0) {
        await User.updateMany(
          { fcm_token: { $in: pushResult.invalidTokens } },
          { $unset: { fcm_token: 1 } }
        );
      }
    }

    // Log to CommunicationLog for history tracking
    try {
      const adminId = req.user._id || req.user.id;
      // Insert a single summary log instead of per-user to avoid bloat
      await CommunicationLog.create({
        channel: 'push', type: type || 'general', subject: title, message,
        status: 'sent', sent_by: adminId, recipient_type: 'all',
        sent_count: pushResult.successCount,
        sent_at: new Date(),
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: `Notification sent to ${docs.length} users`,
      push: { sent: pushResult.successCount, failed: pushResult.failureCount, total_tokens: fcmTokens.length }
    });
  } catch (err) { next(err); }
};

// Register/update FCM token for push notifications
exports.registerFcmToken = async (req, res, next) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ success: false, message: 'fcm_token is required' });
    }
    const userId = req.user._id || req.user.id;

    // Check if this user already had a token (to decide if welcome push is needed)
    const existingUser = await User.findById(userId).select('fcm_token full_name kyc_status');
    const isFirstToken = !existingUser?.fcm_token;

    // Clear this token from any other user (device switched accounts)
    await User.updateMany(
      { fcm_token, _id: { $ne: userId } },
      { $unset: { fcm_token: 1 } }
    );
    await User.findByIdAndUpdate(userId, { fcm_token });

    // Send welcome push notification on first FCM registration
    if (isFirstToken && existingUser) {
      try {
        const name = existingUser.full_name || 'there';
        await Notification.create({
          user_id: userId,
          title: '🙏 Welcome to Assure ChitFunds!',
          message: `Hi ${name}, thank you for joining! Explore chit groups, track payments, participate in auctions, and grow your savings with us.`,
          type: 'general',
          data: { screen: 'dashboard' },
          sent_at: new Date(),
          delivery_method: ['push', 'in_app'],
        });
        await sendPushNotification(fcm_token,
          '🙏 Welcome to Assure ChitFunds!',
          `Hi ${name}, thank you for joining! Explore chit groups, track payments, participate in auctions, and grow your savings with us.`,
          { type: 'general', screen: 'dashboard' }
        );

        // If KYC is pending, send a follow-up after a short delay
        if (existingUser.kyc_status !== 'verified') {
          setTimeout(async () => {
            try {
              await Notification.create({
                user_id: userId,
                title: '📋 Complete Your KYC to Get Started',
                message: `Hi ${name}, complete your KYC verification to unlock bidding, payments, and dividends. It only takes 2 minutes!`,
                type: 'kyc_update',
                data: { screen: 'kyc' },
                sent_at: new Date(),
                delivery_method: ['push', 'in_app'],
              });
              await sendPushNotification(fcm_token,
                '📋 Complete Your KYC to Get Started',
                `Hi ${name}, complete your KYC verification to unlock bidding, payments, and dividends. It only takes 2 minutes!`,
                { type: 'kyc_update', screen: 'kyc' }
              );
            } catch (_) { /* ignore */ }
          }, 30000); // 30 seconds after welcome
        }
      } catch (_) { /* don't fail registration if welcome push fails */ }
    }

    res.json({ success: true, message: 'FCM token registered' });
  } catch (err) { next(err); }
};

// Get unread count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user_id: req.user._id || req.user.id, is_read: false });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
};
