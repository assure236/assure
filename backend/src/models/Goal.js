const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['Savings', 'Home', 'Education', 'Marriage', 'Business', 'Vehicle', 'Emergency', 'Other'], default: 'Savings' },
  target_amount: { type: Number, required: true },
  current_amount: { type: Number, default: 0 },
  target_date: Date,
  is_completed: { type: Boolean, default: false },
  completed_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

goalSchema.index({ user_id: 1 });

const Goal = mongoose.model('Goal', goalSchema);
module.exports = Goal;
