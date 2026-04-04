'use strict';
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  account_number: { type: String, unique: true, sparse: true },
  parent_account: { type: String, default: null, ref: 'Account' },
  root_type: { type: String, enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'], required: true },
  account_type: {
    type: String,
    enum: [
      'Bank', 'Cash', 'Receivable', 'Payable', 'Stock', 'Fixed Asset',
      'Income Account', 'Expense Account', 'Cost of Goods Sold',
      'Tax', 'Chit Fund', 'Commission', 'Depreciation',
      'Capital', 'Retained Earnings', 'Round Off', 'Temporary',
    ],
    default: null,
  },
  is_group: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  description: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  company: { type: String, default: 'Assure Chit Funds' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

accountSchema.index({ root_type: 1 });
accountSchema.index({ parent_account: 1 });
accountSchema.index({ is_group: 1, is_active: 1 });

module.exports = mongoose.model('Account', accountSchema);
