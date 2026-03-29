const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  member_id: { type: String, unique: true, sparse: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['member', 'admin', 'super_admin', 'manager', 'agent'], default: 'member' },
  pan_number: { type: String, unique: true, sparse: true },
  aadhaar_number: { type: String, unique: true, sparse: true },
  date_of_birth: Date,
  address: String,
  city: String,
  state: String,
  pincode: String,
  kyc_status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  kyc_verified_at: Date,
  credit_score: { type: Number, default: 500 },
  profile_image_url: String,
  referral_code: { type: String, unique: true, sparse: true },
  referred_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_active: { type: Boolean, default: true },
  last_login_at: Date,
  fcm_token: String,
  digilocker_id: String,
  kyc_rejection_reason: String,
  bank_account_number: String,
  bank_ifsc_code: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

userSchema.pre('save', async function () {
  if (this.isModified('password_hash')) {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
  }
  if (this.isNew && this.role === 'member' && !this.member_id) {
    const last = await mongoose.model('User').findOne({ member_id: /^MEM\d+$/ }, 'member_id').sort({ member_id: -1 }).lean();
    const nextNum = last ? parseInt(last.member_id.replace('MEM', ''), 10) + 1 : 1;
    this.member_id = `MEM${String(nextNum).padStart(6, '0')}`;
  }
  if (this.isNew && !this.referral_code) {
    this.referral_code = `${(this.full_name || 'USR').substring(0, 3).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
});

userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
