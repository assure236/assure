const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral_code_used: { type: String, required: true },
  bonus_amount: { type: Number, default: 0 },
  bonus_credited: { type: Boolean, default: false },
  credited_at: Date,
  status: { type: String, enum: ['pending', 'qualified', 'credited', 'expired'], default: 'pending' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
