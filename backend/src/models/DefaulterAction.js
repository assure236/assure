const mongoose = require('mongoose');

const defaulterActionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup' },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  action_type: {
    type: String,
    enum: ['reminder_1', 'reminder_2', 'reminder_3', 'legal_notice', 'penalty', 'waiver'],
    required: true
  },
  channels: [{ type: String, enum: ['sms', 'push', 'email'] }],
  message: String,
  details: mongoose.Schema.Types.Mixed,
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

defaulterActionSchema.index({ user_id: 1, chit_group_id: 1, action_type: 1 });
defaulterActionSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('DefaulterAction', defaulterActionSchema);
