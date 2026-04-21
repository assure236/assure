const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'expired'], default: 'pending' },
  token: { type: String, default: null },
  refreshToken: { type: String, default: null },
  user: { type: mongoose.Schema.Types.Mixed, default: null },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete documents after they expire (MongoDB TTL index)
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 });

module.exports = mongoose.model('QrSession', qrSessionSchema);
