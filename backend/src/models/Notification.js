const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['payment_reminder', 'payment_received', 'auction_alert', 'auction_result', 'dividend_credit', 'kyc_update', 'referral_bonus', 'general', 'promotional'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  is_read: { type: Boolean, default: false },
  read_at: Date,
  delivery_method: { type: [String], default: ['push'] },
  sent_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
