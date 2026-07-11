/**
 * One-off push test for VPS:
 *   node scripts/test-push.js
 *   node scripts/test-push.js 6305846093
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { initFirebase, sendPushNotification } = require('../src/config/firebase');

const mobile = process.argv[2] || '6305846093';

(async () => {
  try {
    const app = initFirebase();
    console.log('init=', !!app);
    if (!app) {
      console.error('Firebase failed to initialize. Check firebase-service-account.json');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const user = await mongoose.connection.collection('users').findOne(
      { mobile: String(mobile) },
      { projection: { full_name: 1, fcm_token: 1, mobile: 1 } }
    );

    if (!user) {
      console.error('User not found for mobile', mobile);
      process.exit(1);
    }
    if (!user.fcm_token) {
      console.error('No fcm_token for', user.full_name || mobile, '- open app, allow notifications, login once');
      process.exit(1);
    }

    const result = await sendPushNotification(
      user.fcm_token,
      'Assure Test',
      'Push fixed — if you see this, FCM works.',
      { type: 'general' }
    );
    console.log((user.full_name || user.mobile), '=>', result);
    process.exit(result && result !== 'INVALID_TOKEN' ? 0 : 2);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
})();
