const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel: { type: String, enum: ['sms', 'email', 'whatsapp', 'push', 'notification'], default: 'sms' },
  type: { type: String },  // alias for channel; stored for query compatibility
  recipient_type: String,
  subject: String,
  message: { type: String, required: true },
  sent_count: { type: Number, default: 0 },
  sent_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['queued', 'sent', 'failed', 'partial'], default: 'sent' },
  error_message: String,
  sent_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const CommunicationLog = mongoose.model('CommunicationLog', communicationLogSchema);
module.exports = CommunicationLog;
