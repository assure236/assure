// Run: node write-models.js
// Writes all Mongoose model files for MongoDB migration
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'src/models');

const files = {

'ChitMember.js': `const mongoose = require('mongoose');

const chitMemberSchema = new mongoose.Schema({
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket_number: { type: Number, required: true },
  enrollment_date: { type: Date, default: Date.now },
  has_won_auction: { type: Boolean, default: false },
  auction_won_month: Number,
  total_paid_amount: { type: Number, default: 0 },
  outstanding_amount: { type: Number, default: 0 },
  late_fee_amount: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  exit_date: Date,
  exit_reason: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

chitMemberSchema.index({ chit_group_id: 1, ticket_number: 1 }, { unique: true });
chitMemberSchema.index({ user_id: 1 });

const ChitMember = mongoose.model('ChitMember', chitMemberSchema);
module.exports = ChitMember;
`,

'Auction.js': `const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  month_number: { type: Number, required: true },
  auction_date: { type: Date, required: true },
  start_time: Date,
  end_time: Date,
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  winning_bid_amount: Number,
  winner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winner_ticket_number: Number,
  dividend_per_member: { type: Number, default: 0 },
  total_bids: { type: Number, default: 0 },
  disbursement_amount: Number,
  disbursement_date: Date,
  disbursement_status: { type: String, enum: ['pending', 'approved', 'disbursed', 'rejected'], default: 'pending' },
  transaction_reference: String,
  notes: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Auction = mongoose.model('Auction', auctionSchema);
module.exports = Auction;
`,

'Bid.js': `const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket_number: { type: Number, required: true },
  bid_amount: { type: Number, required: true },
  bid_time: { type: Date, default: Date.now },
  is_winning_bid: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

bidSchema.index({ auction_id: 1 });
bidSchema.index({ user_id: 1 });

const Bid = mongoose.model('Bid', bidSchema);
module.exports = Bid;
`,

'Payment.js': `const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payment_number: { type: String, unique: true, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  month_number: { type: Number, required: true },
  payment_type: { type: String, enum: ['installment', 'late_fee', 'penalty', 'refund'], default: 'installment' },
  amount: { type: Number, required: true },
  late_fee: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  payment_method: { type: String, enum: ['online', 'cash', 'cheque', 'bank_transfer'], required: true },
  payment_gateway: String,
  transaction_id: { type: String, unique: true, sparse: true },
  cashfree_order_id: String,
  payment_status: { type: String, enum: ['pending', 'success', 'failed', 'refunded', 'overdue'], default: 'pending' },
  payment_date: Date,
  due_date: Date,
  notes: String,
  overdue_days: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

paymentSchema.index({ user_id: 1 });
paymentSchema.index({ chit_group_id: 1 });
paymentSchema.index({ payment_status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
`,

'Document.js': `const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup' },
  document_type: {
    type: String,
    enum: ['pan_card', 'aadhaar_card', 'photo', 'address_proof', 'bank_statement', 'chit_agreement', 'payment_receipt', 'other'],
    required: true
  },
  document_name: { type: String, required: true },
  file_url: { type: String, required: true },
  file_size: Number,
  mime_type: String,
  s3_key: String,
  file_name: String,
  uploaded_from: { type: String, enum: ['web', 'mobile', 'admin', 'digilocker'], default: 'web' },
  verification_status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verified_at: Date,
  notes: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
`,

'Referral.js': `const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral_code_used: { type: String, required: true },
  bonus_amount: { type: Number, default: 0 },
  bonus_credited: { type: Boolean, default: false },
  credited_at: Date,
  status: { type: String, enum: ['pending', 'qualified', 'credited', 'expired'], default: 'pending' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
`,

'Notification.js': `const mongoose = require('mongoose');

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
`,

'AppSetting.js': `const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: String,
  label: String,
  group: { type: String, default: 'general' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
module.exports = AppSetting;
`,

'Branch.js': `const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  city: String,
  state: String,
  pincode: String,
  phone: String,
  email: String,
  manager_name: String,
  is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Branch = mongoose.model('Branch', branchSchema);
module.exports = Branch;
`,

'CommunicationLog.js': `const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
  channel: { type: String, enum: ['sms', 'email', 'whatsapp', 'push'], required: true, default: 'sms' },
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
`,

'SupportTicket.js': `const mongoose = require('mongoose');

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
`,

};

let done = 0;
for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(modelsDir, filename), content, 'utf8');
  console.log(`✓ ${filename}`);
  done++;
}
console.log(`\nAll ${done} models written successfully.`);
