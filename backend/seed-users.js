// Run: node seed-users.js
// Seeds the users from CREDENTIALS.md into MongoDB
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds';

const userSchema = new mongoose.Schema({
  member_id:       String,
  referral_code:   String,
  full_name:       String,
  email:           String,
  mobile:          String,
  password_hash:   String,
  role:            { type: String, enum: ['admin', 'manager', 'agent', 'member'], default: 'member' },
  is_active:       { type: Boolean, default: true },
  kyc_status:      { type: String, enum: ['not_submitted', 'pending', 'verified', 'rejected'], default: 'not_submitted' },
  credit_score:    { type: Number, default: 750 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const usersToSeed = [
  {
    full_name:    'Super Admin',
    email:        'assure.fund@outlook.com',
    mobile:       '9000000000',
    password:     'Varsha@2026',
    role:         'admin',
    kyc_status:   'verified',
    member_id:    'MEM000001',
    referral_code:'ADMIN001',
  },
  {
    full_name:    'Test Member',
    email:        'test@assurechitfunds.com',
    mobile:       '9876543210',
    password:     'Test@123456',
    role:         'member',
    kyc_status:   'verified',
    member_id:    'MEM000002',
    referral_code:'TEST0002',
  },
  {
    full_name:    'Priya Sharma',
    email:        'priya@assurechitfunds.com',
    mobile:       '9123456780',
    password:     'Member@123456',
    role:         'member',
    kyc_status:   'verified',
    member_id:    'MEM000003',
    referral_code:'PRIYA003',
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  let created = 0, skipped = 0;

  for (const u of usersToSeed) {
    const existing = await User.findOne({ $or: [{ email: u.email }, { mobile: u.mobile }] });
    if (existing) {
      console.log(`SKIP  ${u.email} — already exists (role: ${existing.role})`);
      skipped++;
      continue;
    }

    const password_hash = await bcrypt.hash(u.password, 12);
    await User.create({
      member_id:    u.member_id,
      referral_code: u.referral_code,
      full_name:    u.full_name,
      email:        u.email,
      mobile:       u.mobile,
      password_hash,
      role:         u.role,
      is_active:    true,
      kyc_status:   u.kyc_status,
      credit_score: 750,
    });
    console.log(`CREATE ${u.email} (${u.role}) — password: ${u.password}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e.message); process.exit(1); });
