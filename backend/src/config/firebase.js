const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let firebaseApp = null;
let messagingApi = null;

const loadServiceAccount = () => {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson);
    } catch (err) {
      logger.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ' + (err.message || String(err)));
      return null;
    }
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const defaultPath = path.join(__dirname, '../../firebase-service-account.json');
  const candidatePaths = [configuredPath, defaultPath].filter(Boolean);

  for (const candidate of candidatePaths) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const fileContent = fs.readFileSync(candidate, 'utf8');
      return JSON.parse(fileContent);
    } catch (err) {
      logger.error(`Failed loading Firebase service account from ${candidate}: ${err.message || String(err)}`);
    }
  }

  return null;
};

/**
 * firebase-admin@14+ dropped Node 20 and broke legacy `admin.apps`.
 * Use modular entry points with a safe fallback for older SDKs.
 */
const initFirebase = () => {
  try {
    if (firebaseApp) return firebaseApp;

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      logger.warn('Firebase Admin SDK initialization skipped: no service account found. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH on server.');
      return null;
    }

    // Prefer modular API (works on firebase-admin 11–13 with Node 18/20).
    try {
      const { initializeApp, getApps, cert } = require('firebase-admin/app');
      const { getMessaging } = require('firebase-admin/messaging');
      const existing = typeof getApps === 'function' ? getApps() : [];
      firebaseApp = existing.length
        ? existing[0]
        : initializeApp({ credential: cert(serviceAccount) });
      messagingApi = getMessaging(firebaseApp);
      logger.info('Firebase Admin SDK initialized successfully');
      return firebaseApp;
    } catch (modularErr) {
      // Legacy namespace fallback for older installs.
      const admin = require('firebase-admin');
      const apps = admin.apps;
      if (Array.isArray(apps) && apps.length > 0) {
        firebaseApp = apps[0];
      } else {
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      messagingApi = admin.messaging();
      logger.info('Firebase Admin SDK initialized successfully (legacy)');
      return firebaseApp;
    }
  } catch (err) {
    logger.error('Firebase Admin SDK initialization failed: ' + (err.message || String(err)));
    firebaseApp = null;
    messagingApi = null;
    return null;
  }
};

const getMessaging = () => {
  if (!messagingApi) {
    if (!firebaseApp) initFirebase();
  }
  return messagingApi;
};

/**
 * Send push notification to a single device token.
 * @returns {Promise<string|null>} message ID, 'INVALID_TOKEN', or null on failure
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
          tag: data.type ? `${data.type}_${Date.now()}` : undefined,
        },
        collapseKey: data.type || 'general',
      },
    };

    const response = await messaging.send(message);
    logger.info(`Push sent to token ${String(fcmToken).substring(0, 10)}...: ${response}`);
    return response;
  } catch (err) {
    logger.error(`Push send failed for token ${String(fcmToken).substring(0, 10)}...: ${err.message}`);
    const staleTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/mismatched-credential',
    ];
    if (staleTokenCodes.includes(err.code)) {
      return 'INVALID_TOKEN';
    }
    return null;
  }
};

/**
 * Send push notification to multiple device tokens.
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
    const staleTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/mismatched-credential',
    ];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || 'unknown';
        logger.warn(`Push failed for token ${fcmTokens[idx].substring(0, 10)}...: ${code}`);
        if (staleTokenCodes.includes(code)) {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    logger.info(`Push multicast: ${response.successCount} sent, ${response.failureCount} failed, ${invalidTokens.length} stale tokens cleaned`);
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
