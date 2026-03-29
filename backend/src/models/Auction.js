const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  chit_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitGroup', required: true },
  month_number: { type: Number, required: true },
  auction_date: { type: Date, required: true },
  start_time: Date,
  end_time: Date,
  status: { type: String, enum: ['scheduled', 'in_progress', 'paused', 'completed', 'cancelled'], default: 'scheduled' },
  winning_bid_amount: Number,
  winner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winner_ticket_number: Number,
  dividend_per_member: { type: Number, default: 0 },
  commission_amount: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  total_bids: { type: Number, default: 0 },
  disbursement_amount: Number,
  disbursement_date: Date,
  disbursement_status: { type: String, enum: ['pending', 'approved', 'disbursed', 'rejected'], default: 'pending' },
  transaction_reference: String,
  notes: String,
  // Runtime / disbursal tracking fields
  actual_start_time: Date,
  actual_end_time: Date,
  scheduled_end_time: Date,
  dividend_amount: Number,
  utr_number: String,
  disbursement_approved_at: Date,
  disbursement_approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // ── Live Bidding Settings ──
  duration_minutes: { type: Number, default: 30 },            // auction duration in minutes
  min_bid_increment: { type: Number, default: 100 },          // minimum amount above current highest bid
  anti_snipe_seconds: { type: Number, default: 15 },          // trigger anti-snipe if bid in last N seconds
  anti_snipe_extension: { type: Number, default: 30 },        // extend timer by N seconds on anti-snipe
  bid_fee: { type: Number, default: 0 },                      // fee per bid (deducted from wallet, 0 = free)
  max_bids_per_user: { type: Number, default: 0 },            // 0 = unlimited
  // ── Live Stats (updated in real-time) ──
  current_highest_bid: Number,
  total_bid_count: { type: Number, default: 0 },
  paused_time_remaining: { type: Number, default: 0 },  // seconds remaining when paused
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Auction = mongoose.model('Auction', auctionSchema);
module.exports = Auction;
