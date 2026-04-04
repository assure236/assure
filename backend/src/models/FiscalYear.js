'use strict';
const mongoose = require('mongoose');

const fiscalYearSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g. "2025-26"
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  is_closed: { type: Boolean, default: false },
  company: { type: String, default: 'Assure Chit Funds' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('FiscalYear', fiscalYearSchema);
