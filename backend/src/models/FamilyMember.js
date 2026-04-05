const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  full_name: { type: String, required: true },
  relationship: { type: String, required: true, enum: ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'other'] },
  mobile: { type: String },
  email: { type: String },
  date_of_birth: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  aadhaar_number: String,
  pan_number: String,
  is_nominee: { type: Boolean, default: false },
  linked_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

familyMemberSchema.index({ user_id: 1, is_active: 1 });

const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);
module.exports = FamilyMember;
