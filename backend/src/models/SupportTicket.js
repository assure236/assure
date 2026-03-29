const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticket_number: { type: String, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution: String,
  resolved_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

supportTicketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticket_number) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticket_number = 'TKT' + String(count + 1).padStart(4, '0');
  }
  next();
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
