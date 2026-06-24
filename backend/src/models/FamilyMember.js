const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/fieldEncryption');

const familyMemberSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  member_id: { type: String, index: true },
  full_name: { type: String, required: true },
  relationship: { type: String, required: true, enum: ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'other'], default: 'other' },
  mobile: { type: String },
  email: { type: String },
  date_of_birth: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  aadhaar_number: String,
  pan_number: String,
  is_nominee: { type: Boolean, default: false },
  linked_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'linked'], default: 'pending' },
  admin_note: String,
  reviewed_at: Date,
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ENCRYPTED_FIELDS = ['aadhaar_number', 'pan_number'];

familyMemberSchema.pre('save', function (next) {
  // SECURITY FIX: encrypt family-member PII fields before persisting to DB.
  for (const field of ENCRYPTED_FIELDS) {
    if (this.isModified(field) && this[field]) {
      this[field] = encrypt(this[field]);
    }
  }
  next();
});

function decryptFamilyDoc(doc) {
  if (!doc) return;
  for (const field of ENCRYPTED_FIELDS) {
    if (doc[field]) {
      doc[field] = decrypt(doc[field]);
    }
  }
}

// SECURITY FIX: decrypt encrypted family-member PII fields after DB reads.
familyMemberSchema.post('init', function (doc) {
  decryptFamilyDoc(doc);
});
familyMemberSchema.post('findOne', function (doc) {
  decryptFamilyDoc(doc);
});
familyMemberSchema.post('find', function (docs) {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => decryptFamilyDoc(doc));
});

familyMemberSchema.index({ user_id: 1, is_active: 1 });

const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);
module.exports = FamilyMember;
