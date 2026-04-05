const { Notification, User } = require('../models');
const { sendPushNotification } = require('../config/firebase');
const logger = require('./logger');

/**
 * Create an in-app notification and send FCM push to a user.
 * @param {string} userId - The user's ObjectId
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {string} type - Notification type enum value
 * @param {object} [data] - Optional extra data payload
 */
async function notifyUser(userId, title, message, type = 'general', data = {}) {
  try {
    // Create in-app notification
    const notification = await Notification.create({
      user_id: userId,
      title,
      message,
      type,
      data,
      sent_at: new Date(),
    });

    // Send FCM push
    const user = await User.findById(userId).select('fcm_token');
    if (user?.fcm_token) {
      const result = await sendPushNotification(
        user.fcm_token,
        title,
        message,
        { type, notification_id: notification._id.toString(), ...data }
      );
      if (result === 'INVALID_TOKEN') {
        await User.findByIdAndUpdate(userId, { $unset: { fcm_token: 1 } });
      }
    }

    return notification;
  } catch (err) {
    logger.error(`notifyUser failed for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Notify multiple users (e.g., all group members).
 * @param {string[]} userIds - Array of user ObjectIds
 * @param {string} title
 * @param {string} message
 * @param {string} type
 * @param {object} [data]
 */
async function notifyMultiple(userIds, title, message, type = 'general', data = {}) {
  const promises = userIds.map(id => notifyUser(id, title, message, type, data));
  return Promise.allSettled(promises);
}

module.exports = { notifyUser, notifyMultiple };
