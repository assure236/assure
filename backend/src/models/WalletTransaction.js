const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wallet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bid_fee', 'bid_lock', 'bid_unlock', 'refund', 'reward', 'dividend', 'installment', 'auction_winning'],
    required: true,
  },
  amount: { type: Number, required: true },
  balance_after: { type: Number, required: true },
  description: { type: String, default: '' },
  reference_id: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

walletTransactionSchema.index({ user_id: 1, created_at: -1 });
walletTransactionSchema.index({ wallet_id: 1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
module.exports = WalletTransaction;
