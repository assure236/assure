const mongoose = require('mongoose');

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
