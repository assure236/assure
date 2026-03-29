require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const base = 'http://localhost:5000/api/v1';

async function test() {
  console.log('\n====== AUTH END-TO-END TEST ======\n');

  // ── 1. Check MongoDB connection & existing users ──────────────────────────
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds');
  const User = require('./src/models/User');
  const users = await User.find({}, 'full_name mobile email role member_id').lean();
  console.log('DB Users stored:', users.length);
  users.forEach(u => console.log(`  - ${u.full_name} | ${u.mobile} | ${u.email} | ${u.role} | ${u.member_id}`));

  // Clean up test user if exists from previous run
  await User.deleteOne({ mobile: '9111111112' });

  // ── 2. Register flow ──────────────────────────────────────────────────────
  console.log('\n--- REGISTER FLOW ---');

  // Step A: mobile OTP (dev OTP returned)
  let r = await axios.post(base + '/auth/resend-otp', { mobile: '9111111112' });
  const motp = r.data.otp;
  console.log('Send mobile OTP:', motp ? 'OK (dev OTP=' + motp + ')' : 'FAIL - no dev OTP');
  if (!motp) { console.error('ERROR: No dev OTP for mobile'); process.exit(1); }

  // Step B: verify mobile OTP
  r = await axios.post(base + '/auth/verify-otp', { mobile: '9111111112', otp: motp, type: 'mobile' });
  console.log('Verify mobile OTP:', r.data.success ? 'OK' : 'FAIL - ' + r.data.message);

  // Step C: email OTP — get it directly from DB
  r = await axios.post(base + '/auth/resend-otp', { email: 'testreguser99@gmail.com', type: 'email' });
  console.log('Send email OTP:', r.data.message);
  // Email OTP not returned in response — read it from process memory via a trick
  // We'll test email OTP by sending with wrong OTP first, then correct
  // For test purposes, temporarily flip dev mode
  // Instead: query the app memory by sending again (each call overwrites - use a patched endpoint)
  // BEST APPROACH: just set NODE_ENV=development temporarily and re-send
  process.env.NODE_ENV = 'development';
  r = await axios.post(base + '/auth/resend-otp', { email: 'testreguser99@gmail.com', type: 'email' });
  const eotp = r.data.otp;
  process.env.NODE_ENV = process.env.NODE_ENV_ORIG || 'development';
  console.log('Email OTP (via dev mode temp):', eotp || '(NOT RETURNED - check backend NODE_ENV)');

  if (!eotp) {
    console.log('NOTE: Email dev OTP not available. Skipping email OTP register test.');
    await mongoose.disconnect();
    return testLogin();
  }

  // Step D: verify email OTP
  r = await axios.post(base + '/auth/verify-otp', { email: 'testreguser99@gmail.com', otp: eotp, type: 'email' });
  console.log('Verify email OTP:', r.data.success ? 'OK' : 'FAIL - ' + r.data.message);

  // Step E: register
  r = await axios.post(base + '/auth/register', {
    full_name: 'Register Test', mobile: '9111111112', email: 'testreguser99@gmail.com', mpin: '654321'
  });
  const regOk = r.data.success;
  console.log('Register:', regOk ? 'OK member_id=' + r.data.data.user.member_id : 'FAIL - ' + r.data.message);

  if (regOk) {
    // Verify in MongoDB
    const dbUser = await User.findOne({ mobile: '9111111112' }).lean();
    console.log('MongoDB check:');
    console.log('  full_name:', dbUser.full_name);
    console.log('  mobile:', dbUser.mobile);
    console.log('  email:', dbUser.email);
    console.log('  password_hash stored:', dbUser.password_hash ? 'YES (bcrypt)' : 'NO');
    console.log('  member_id:', dbUser.member_id);
    console.log('  role:', dbUser.role);
  }

  await mongoose.disconnect();
  await testLogin();
}

async function testLogin() {
  console.log('\n--- LOGIN SCENARIOS ---');

  // Use existing seeded user — Test Member 9876543210 mpin=123456 (from seed)
  // First get existing user from DB to know their mpin
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds');
  const User = require('./src/models/User');
  const regUser = await User.findOne({ mobile: '9111111112' }).lean();
  await mongoose.disconnect();

  if (regUser) {
    // Login with registered test user (mpin=654321)
    let r = await axios.post(base + '/auth/login', { mobile: '9111111112', mpin: '654321' });
    console.log('Login (correct mobile+mpin):', r.data.success ? 'OK token received' : 'FAIL - ' + r.data.message);

    // Wrong MPIN
    r = await axios.post(base + '/auth/login', { mobile: '9111111112', mpin: '000000' }).catch(e => e.response);
    console.log('Login (wrong mpin):', r.data.message);
  }

  // Unregistered number — must be rejected
  let r = await axios.post(base + '/auth/login', { mobile: '9000000099', mpin: '123456' }).catch(e => e.response);
  console.log('Login (unregistered number):', r.data.message);

  console.log('\n====== TEST COMPLETE ======\n');
}

test().catch(e => {
  console.error('TEST ERROR:', e.response?.data || e.message);
  process.exit(1);
});
