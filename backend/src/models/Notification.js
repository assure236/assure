const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'payment_reminder', 'payment_received', 'auction_alert', 'auction_result',
      'dividend_credit', 'kyc_update', 'referral_bonus', 'general', 'promotional',
      'loan_update', 'support_update', 'document_verified', 'account_update',
      'wallet_update', 'disbursal_update',
      'profile_edit_request', 'profile_edit_approved', 'profile_edit_rejected',
      'chit_transfer_request', 'chit_cancel_request',
      'admin_chit_transfer', 'admin_chit_cancel',
    ],
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

notificationSchema.index({ user_id: 1, is_read: 1 });
notificationSchema.index({ user_id: 1, created_at: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
