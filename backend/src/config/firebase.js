const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

let firebaseApp = null;

const initFirebase = () => {
  try {
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (err) {
    logger.error('Firebase Admin SDK initialization failed:', err.message);
    return null;
  }
};

const getMessaging = () => {
  if (!firebaseApp) return null;
  return admin.messaging();
};

/**
 * Send push notification to a single device token.
 * @param {string} fcmToken - The device FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 * @returns {Promise<string|null>} message ID or null on failure
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  const messaging = getMessaging();
  if (!messaging) {
    logger.warn('Firebase not initialized, skipping push notification');
    return null;
  }

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'assure_chitfunds',
          sound: 'default',
        },
      },
    };

    const response = await messaging.send(message);
    logger.info(`Push sent to token ${fcmToken.substring(0, 10)}...: ${response}`);
    return response;
  } catch (err) {
    logger.error(`Push send failed for token ${fcmToken.substring(0, 10)}...: ${err.message}`);
    // If token is invalid, return special marker so caller can clean up
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered'
    ) {
      return 'INVALID_TOKEN';
    }
    return null;
  }
};

/**
 * Send push notification to multiple device tokens.
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 * @returns {Promise<{successCount: number, failureCount: number, invalidTokens: string[]}>}
 */
const sendPushToMultiple = async (fcmTokens, title, body, data = {}) => {
  const messaging = getMessaging();
  if (!messaging || !fcmTokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const message = {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'assure_chitfunds',
          sound: 'default',
        },
      },
    };

    const response = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });

    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        (resp.error?.code === 'messaging/invalid-registration-token' ||
          resp.error?.code === 'messaging/registration-token-not-registered')
      ) {
        invalidTokens.push(fcmTokens[idx]);
      }
    });

    logger.info(`Push multicast: ${response.successCount} sent, ${response.failureCount} failed`);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (err) {
    logger.error(`Push multicast failed: ${err.message}`);
    return { successCount: 0, failureCount: fcmTokens.length, invalidTokens: [] };
  }
};

module.exports = { initFirebase, getMessaging, sendPushNotification, sendPushToMultiple };
