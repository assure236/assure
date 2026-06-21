const mongoose = require('mongoose');

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

familyMemberSchema.index({ user_id: 1, is_active: 1 });

const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);
module.exports = FamilyMember;
