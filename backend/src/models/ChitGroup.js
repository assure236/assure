const mongoose = require('mongoose');

const chitGroupSchema = new mongoose.Schema({
  group_number: { type: String, unique: true, required: true },
  pso_number: { type: String, default: '' },
  group_name: { type: String, required: true },
  total_members: { type: Number, required: true },
  chit_value: { type: Number, required: true },
  monthly_installment: { type: Number, required: true },
  duration_months: { type: Number, required: true },
  prized_subscriber_offer: { type: Number, default: 0 },
  foreman_commission_percentage: { type: Number, default: 5.0 },
  fdr_percentage: { type: Number, default: 10.0 },
  commencement_date: { type: Date, required: true },
  closure_date: Date,
  auction_day: { type: Number, required: true },
  auction_time: { type: String, default: '10:00:00' },
  status: { type: String, enum: ['not_started', 'active', 'vacant', 'closed', 'suspended', 'completed'], default: 'not_started' },
  description: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ChitGroup = mongoose.model('ChitGroup', chitGroupSchema);
module.exports = ChitGroup;
