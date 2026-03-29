const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payment_number: { type: String, unique: true, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  month_number: { type: Number, required: true },
  payment_type: { type: String, enum: ['installment', 'late_fee', 'penalty', 'refund'], default: 'installment' },
  amount: { type: Number, required: true },
  late_fee: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  payment_method: { type: String, enum: ['online', 'cash', 'cheque', 'bank_transfer'], required: true },
  payment_gateway: String,
  transaction_id: { type: String, unique: true, sparse: true },
  cashfree_order_id: String,
  payment_status: { type: String, enum: ['pending', 'success', 'failed', 'refunded', 'overdue'], default: 'pending' },
  payment_date: Date,
  due_date: Date,
  notes: String,
  overdue_days: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

paymentSchema.index({ user_id: 1 });
paymentSchema.index({ chit_group_id: 1 });
paymentSchema.index({ payment_status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
