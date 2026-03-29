const mongoose = require('mongoose');

const chitMemberSchema = new mongoose.Schema({
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket_number: { type: Number, required: true },
  enrollment_date: { type: Date, default: Date.now },
  has_won_auction: { type: Boolean, default: false },
  auction_won_month: Number,
  total_paid_amount: { type: Number, default: 0 },
  outstanding_amount: { type: Number, default: 0 },
  late_fee_amount: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  exit_date: Date,
  exit_reason: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

chitMemberSchema.index({ chit_group_id: 1, ticket_number: 1 }, { unique: true });
chitMemberSchema.index({ user_id: 1 });

const ChitMember = mongoose.model('ChitMember', chitMemberSchema);
module.exports = ChitMember;
