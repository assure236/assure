const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup' },
  document_type: {
    type: String,
    enum: ['aadhaar_card', 'pan_card', 'cancelled_cheque', 'selfie_photo'],
    required: true
  },
  document_name: { type: String, required: true },
  file_url: { type: String, required: true },
  file_size: Number,
  mime_type: String,
  s3_key: String,
  file_name: String,
  uploaded_from: { type: String, enum: ['web', 'mobile', 'admin', 'digilocker'], default: 'web' },
  verification_status: { type: String, enum: ['pending', 'verified', 'approved', 'rejected'], default: 'pending' },
  verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verified_at: Date,
  notes: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
