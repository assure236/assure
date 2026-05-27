const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral_code_used: { type: String, required: true },
  bonus_amount: { type: Number, default: 100 },
  bonus_credited: { type: Boolean, default: false },
  credited_at: Date,
  qualified_at: Date,
  qualified_chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup' },
  discount_applied: { type: Boolean, default: false },
  discount_applied_at: Date,
  discount_payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  status: { type: String, enum: ['pending', 'qualified', 'credited', 'expired'], default: 'pending' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
