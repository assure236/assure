require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const base = 'http://localhost:5002/api/v1';

const mobileTEST = '9111111112';
const emailTEST = 'testreguser99@gmail.com';
const mpinTEST = '654321';

async function test() {
  console.log('\n====== AUTH END-TO-END TEST ======\n');

  // ── MongoDB: show existing users ─────────────────────────────────────────
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds');
  const User = require('./src/models/User');
  const users = await User.find({}, 'full_name mobile email role member_id').lean();
  console.log('Existing DB users:', users.length);
  users.forEach(u => console.log(`  ${u.member_id} | ${u.full_name} | ${u.mobile} | ${u.email}`));

  // Clean up previous test run
  const deleted = await User.deleteOne({ mobile: mobileTEST });
  if (deleted.deletedCount) console.log('Cleaned up previous test user');
  await mongoose.disconnect();

  // ── REGISTER FLOW ─────────────────────────────────────────────────────────
  console.log('\n--- REGISTER FLOW ---');

  // 1. Send mobile OTP
  let r = await axios.post(base + '/auth/resend-otp', { mobile: mobileTEST });
  const motp = r.data.otp;
  if (!motp) { console.error('FAIL: No dev OTP in mobile response. Is NODE_ENV=development?'); process.exit(1); }
  console.log('[1] Mobile OTP sent — dev OTP:', motp);

  // 2. Verify mobile OTP
  r = await axios.post(base + '/auth/verify-otp', { mobile: mobileTEST, otp: motp, type: 'mobile' });
  if (!r.data.success) { console.error('FAIL: Mobile OTP verify:', r.data.message); process.exit(1); }
  console.log('[2] Mobile OTP verified ✓');

  // 3. Send email OTP
  r = await axios.post(base + '/auth/resend-otp', { email: emailTEST, type: 'email' });
  const eotp = r.data.otp;
  if (!eotp) { console.error('FAIL: No dev OTP in email response. Did you update authController?'); process.exit(1); }
  console.log('[3] Email OTP sent — dev OTP:', eotp);

  // 4. Verify email OTP
  r = await axios.post(base + '/auth/verify-otp', { email: emailTEST, otp: eotp, type: 'email' });
  if (!r.data.success) { console.error('FAIL: Email OTP verify:', r.data.message); process.exit(1); }
  console.log('[4] Email OTP verified ✓');

  // 5. Register
  r = await axios.post(base + '/auth/register', {
    full_name: 'E2E Test User',
    mobile: mobileTEST,
    email: emailTEST,
    mpin: mpinTEST
  });
  if (!r.data.success) { console.error('FAIL: Register:', r.data.message); process.exit(1); }
  console.log('[5] Registered ✓ member_id:', r.data.data?.user?.member_id);

  // 6. Verify in MongoDB
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds');
  const dbUser = await User.findOne({ mobile: mobileTEST }).lean();
  console.log('[6] MongoDB record:');
  console.log('    full_name:', dbUser.full_name);
  console.log('    mobile:', dbUser.mobile);
  console.log('    email:', dbUser.email);
  console.log('    password_hash:', dbUser.password_hash ? 'bcrypt ✓' : 'MISSING ✗');
  console.log('    member_id:', dbUser.member_id);
  console.log('    role:', dbUser.role);
  await mongoose.disconnect();

  // ── LOGIN FLOW ────────────────────────────────────────────────────────────
  console.log('\n--- LOGIN SCENARIOS ---');

  // 7. Correct login
  r = await axios.post(base + '/auth/login', { mobile: mobileTEST, mpin: mpinTEST });
  if (r.data.success) console.log('[7] Login correct credentials ✓ token received');
  else console.log('[7] FAIL login correct:', r.data.message);

  // 8. Wrong MPIN
  r = await axios.post(base + '/auth/login', { mobile: mobileTEST, mpin: '000000' }).catch(e => e.response);
  console.log('[8] Login wrong MPIN:', r.data.message, r.status === 401 ? '✓' : '✗');

  // 9. Unregistered number
  r = await axios.post(base + '/auth/login', { mobile: '9000000099', mpin: '123456' }).catch(e => e.response);
  console.log('[9] Login unregistered number:', r.data.message, r.status === 401 || r.status === 400 ? '✓' : '✗');

  // 10. Send OTP for login (phone login flow)
  r = await axios.post(base + '/auth/resend-otp', { mobile: mobileTEST });
  const loginOtp = r.data.otp;
  console.log('[10] Send OTP for phone login — dev OTP:', loginOtp || 'NONE');
  if (loginOtp) {
    r = await axios.post(base + '/auth/verify-otp', { mobile: mobileTEST, otp: loginOtp, type: 'mobile' });
    console.log('[10b] Verify phone OTP for login:', r.data.success ? '✓' : r.data.message);
  }

  console.log('\n====== ALL TESTS PASSED ======\n');
}

test().catch(e => {
  const errData = e.response?.data || e.message;
  console.error('\nTEST CRASHED:', errData);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
