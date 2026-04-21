const mongoose = require('mongoose');

const agentRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  admin_note: { type: String },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewed_at: { type: Date },
}, { timestamps: true });

agentRequestSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('AgentRequest', agentRequestSchema);
