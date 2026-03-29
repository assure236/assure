const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket_number: { type: Number, required: true },
  bid_amount: { type: Number, required: true },
  bid_time: { type: Date, default: Date.now },
  bid_time_ms: { type: Number, default: () => Date.now() },  // millisecond precision for tiebreaking
  is_winning_bid: { type: Boolean, default: false },
  bid_fee_charged: { type: Number, default: 0 },
  ip_address: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

bidSchema.index({ auction_id: 1, bid_amount: 1 });
bidSchema.index({ auction_id: 1, user_id: 1 });
bidSchema.index({ user_id: 1 });

const Bid = mongoose.model('Bid', bidSchema);
module.exports = Bid;
