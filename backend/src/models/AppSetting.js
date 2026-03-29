const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: String,
  label: String,
  group: { type: String, default: 'general' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
module.exports = AppSetting;
