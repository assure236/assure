const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/fieldEncryption');

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
  address_proof_url: String,
  address_change_status: { type: String, enum: ['none', 'pending_review', 'approved', 'rejected'], default: 'none' },
  kyc_status: { type: String, enum: ['pending', 'not_verified', 'verified', 'rejected'], default: 'pending' },
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
  bank_name: String,
  bank_proof_url: String,
  bank_verified: { type: Boolean, default: false },
  bank_verified_at: Date,
  bank_account_holder_name: String,
  bank_change_status: { type: String, enum: ['none', 'pending_review', 'verified', 'approved', 'rejected'], default: 'none' },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  nominee_name: String,
  nominee_relationship: String,
  current_address: String,
  current_city: String,
  current_state: String,
  current_pincode: String,
  token_version: { type: Number, default: 0 },
  web_token_version: { type: Number, default: 0 },
  // Profile edit lock
  profile_edit_status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  pending_profile_changes: { type: mongoose.Schema.Types.Mixed },
  profile_edit_requested_at: Date,
  profile_edit_reviewed_at: Date,
  profile_edit_reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  profile_edit_rejection_reason: String,
  profile_edit_rejection_fields: [{ type: String }],
  // Step-by-step onboarding wizard progress (web + mobile)
  onboarding: {
    digilocker: {
      status: { type: String, enum: ['pending', 'completed', 'skipped', 'manual'], default: 'pending' },
      completed_at: Date,
    },
    manual_kyc: {
      status: { type: String, enum: ['not_required', 'pending_review', 'approved', 'rejected'], default: 'not_required' },
      submitted_at: Date,
      reviewed_at: Date,
      rejection_reason: String,
    },
    face_match: {
      status: { type: String, enum: ['pending', 'verified', 'failed', 'deferred'], default: 'pending' },
      score: Number,
      completed_at: Date,
      attempts: { type: Number, default: 0 },
    },
    bank: {
      status: { type: String, enum: ['pending', 'verified', 'rejected', 'pending_review'], default: 'pending' },
      name_match_score: Number,
      account_holder_name: String,
      completed_at: Date,
      reviewed_at: Date,
      rejection_reason: String,
    },
    cheque: {
      status: { type: String, enum: ['pending', 'uploaded', 'skipped', 'approved', 'rejected'], default: 'pending' },
      completed_at: Date,
      reviewed_at: Date,
      rejection_reason: String,
    },
    address: {
      status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
      completed_at: Date,
    },
    tour_completed: { type: Boolean, default: false },
    completed_at: Date,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ENCRYPTED_FIELDS = [
  'pan_number',
  'aadhaar_number',
  'bank_account_number',
  'bank_ifsc_code',
  'address',
  'city',
  'state',
  'pincode',
  'current_address',
  'current_city',
  'current_state',
  'current_pincode',
];

userSchema.pre('save', async function () {
  if (this.isModified('password_hash')) {
    // SECURITY FIX: enforce stronger bcrypt cost factor.
    const salt = await bcrypt.genSalt(Math.max(12, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12));
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
  }
  if (this.isNew && this.role === 'member' && !this.member_id) {
    const last = await mongoose.model('User').findOne({ member_id: /^MEM\d+$/ }, 'member_id').sort({ member_id: -1 }).lean();
    const nextNum = last ? parseInt(last.member_id.replace('MEM', ''), 10) + 1 : 1;
    this.member_id = `MEM${String(nextNum).padStart(6, '0')}`;
  }
  if (this.isNew && !this.referral_code) {
    // SECURITY FIX: use crypto-secure randomness for referral code suffix generation.
    this.referral_code = `${(this.full_name || 'USR').substring(0, 3).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  // SECURITY FIX: encrypt PII fields before persisting to DB.
  for (const field of ENCRYPTED_FIELDS) {
    if (this.isModified(field) && this[field]) {
      this[field] = encrypt(this[field]);
    }
  }
});

function decryptUserDoc(doc) {
  if (!doc) return;
  for (const field of ENCRYPTED_FIELDS) {
    if (doc[field]) {
      doc[field] = decrypt(doc[field]);
    }
  }
}

// SECURITY FIX: decrypt encrypted PII fields after reading from DB.
userSchema.post('init', function (doc) {
  decryptUserDoc(doc);
});

userSchema.post('findOne', function (doc) {
  decryptUserDoc(doc);
});

userSchema.post('find', function (docs) {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => decryptUserDoc(doc));
});

userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

// Performance indexes for 50K+ user queries
userSchema.index({ is_active: 1, role: 1 });
// referral_code index defined inline via unique:true on the field
userSchema.index({ fcm_token: 1 }, { sparse: true });
userSchema.index({ created_at: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
