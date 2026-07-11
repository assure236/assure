const mongoose = require('mongoose');

/**
 * Shared across PM2 cluster workers. In-memory Map breaks QR login when
 * generate / confirm / status hit different processes.
 */
const qrLoginSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'consumed'], default: 'pending' },
  expires_at: { type: Date, required: true, index: true },
  token: { type: String, default: '' },
  refresh_token: { type: String, default: '' },
  user: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

// Auto-delete expired rows
qrLoginSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.QrLoginSession
  || mongoose.model('QrLoginSession', qrLoginSessionSchema);
