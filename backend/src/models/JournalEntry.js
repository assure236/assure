'use strict';
const mongoose = require('mongoose');

const journalEntryItemSchema = new mongoose.Schema({
  account: { type: String, required: true },
  party_type: { type: String, enum: ['Member', 'Supplier', 'Company', null], default: null },
  party: { type: String, default: null },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  cost_center: { type: String, default: null },
  description: { type: String, default: '' },
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
  voucher_number: { type: String, required: true, unique: true },
  voucher_type: {
    type: String,
    enum: [
      'Journal Entry', 'Payment Entry', 'Disbursement Entry',
      'Commission Entry', 'Late Fee Entry', 'Penalty Entry',
      'Refund Entry', 'Opening Entry', 'Closing Entry', 'Adjustment',
    ],
    default: 'Journal Entry',
  },
  posting_date: { type: Date, required: true },
  items: [journalEntryItemSchema],
  total_debit: { type: Number, default: 0 },
  total_credit: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  reference_type: { type: String, default: null }, // 'Payment', 'Auction', 'Disbursement'
  reference_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  reference_number: { type: String, default: null },
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', default: null },
  user_remark: { type: String, default: '' },
  title: { type: String, default: '' },
  is_posted: { type: Boolean, default: true },
  is_cancelled: { type: Boolean, default: false },
  cancelled_at: { type: Date, default: null },
  posted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  company: { type: String, default: 'Assure Chit Funds' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

journalEntrySchema.index({ posting_date: -1 });
journalEntrySchema.index({ voucher_type: 1 });
journalEntrySchema.index({ reference_type: 1, reference_id: 1 });
journalEntrySchema.index({ chit_group_id: 1 });
journalEntrySchema.index({ 'items.account': 1 });
journalEntrySchema.index({ is_cancelled: 1 });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
