const mongoose = require('mongoose');
const crypto = require('crypto');

const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_name: String,
  user_role: String,

  // What action was performed
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'logout_all_devices',
      'bid_placed', 'auction_started', 'auction_ended', 'auction_winner_declared',
      'payment_initiated', 'payment_success', 'payment_failed', 'payment_verified',
      'chit_group_created', 'chit_group_enrolled', 'chit_group_transfer_request', 'chit_group_cancel_request',
      'profile_updated', 'profile_edit_requested', 'profile_edit_approved', 'profile_edit_rejected',
      'kyc_verified', 'kyc_rejected',
      'agreement_signed',
      'wallet_credit', 'wallet_debit',
      'admin_action', 'system_event',
    ],
  },

  // Resource affected
  resource_type: { type: String }, // 'user', 'chit_group', 'auction', 'payment', 'wallet'
  resource_id: { type: String },

  // Details
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Location (from mobile device if provided)
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
  },

  // IP address
  ip_address: { type: String },

  // Immutability: hash of previous log entry for chain integrity
  prev_hash: { type: String },
  hash: { type: String },

}, { timestamps: { createdAt: 'created_at' } });

// Disable update/delete operations to ensure immutability
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});
auditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});
auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});
auditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

// Compute hash chain before saving
auditLogSchema.pre('save', async function () {
  if (this.isNew) {
    // Get the last log's hash
    const lastLog = await mongoose.model('AuditLog')
      .findOne({}, 'hash')
      .sort({ created_at: -1 })
      .lean();

    this.prev_hash = lastLog?.hash || '0';

    // Compute hash of this entry
    const payload = JSON.stringify({
      user_id: this.user_id?.toString(),
      action: this.action,
      resource_type: this.resource_type,
      resource_id: this.resource_id,
      description: this.description,
      prev_hash: this.prev_hash,
      created_at: this.created_at || new Date().toISOString(),
    });

    this.hash = crypto.createHash('sha256').update(payload).digest('hex');
  }
});

auditLogSchema.index({ user_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ resource_type: 1, resource_id: 1 });
auditLogSchema.index({ created_at: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
