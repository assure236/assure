const { Auction, Bid, ChitGroup, ChitMember, User, Wallet, WalletTransaction } = require('../models');
const timerManager = require('../services/auctionTimerManager');
const walletController = require('./walletController');
const logger = require('../utils/logger');

const normalizeStatus = (s) => s === 'in_progress' ? 'active' : s;

exports.getUpcomingAuctions = async (req, res, next) => {
  try {
    const auctions = await Auction.find({ status: { $in: ['scheduled', 'in_progress'] } })
      .populate('chit_group_id', 'group_name chit_value')
      .sort({ auction_date: 1 })
      .limit(10);
    const data = auctions.map(a => {
      const obj = a.toObject();
      obj.status = normalizeStatus(obj.status);
      // Inject live timer data if active
      if (obj.status === 'active' && timerManager.isActive(a._id)) {
        obj.server_time_remaining = timerManager.getTimeRemaining(a._id);
        obj.server_end_time = timerManager.getEndTime(a._id)?.toISOString();
        obj.active_users = timerManager.getActiveUserCount(a._id);
      }
      return obj;
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getMyAuctions = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const memberships = await ChitMember.find({ user_id: userId, is_active: true }).select('chit_group_id');
    const groupIds = memberships.map(m => m.chit_group_id);
    const filter = groupIds.length ? { chit_group_id: { $in: groupIds } } : { _id: null };
    const auctions = await Auction.find(filter)
      .populate('chit_group_id', 'group_name chit_value group_number')
      .populate('winner_id', 'full_name')
      .sort({ auction_date: -1 })
      .limit(20);
    const data = auctions.map(a => {
      const obj = { ...a.toObject(), chitGroup: a.chit_group_id, winner: a.winner_id, status: normalizeStatus(a.status) };
      if (obj.status === 'active' && timerManager.isActive(a._id)) {
        obj.server_time_remaining = timerManager.getTimeRemaining(a._id);
        obj.server_end_time = timerManager.getEndTime(a._id)?.toISOString();
        obj.active_users = timerManager.getActiveUserCount(a._id);
      }
      return obj;
    });
    // Also include available wallet balance (balance - locked)
    const walletBalance = await walletController.getAvailableBalance(userId);
    res.json({ success: true, data, wallet_balance: walletBalance });
  } catch (err) { next(err); }
};

exports.getAuctionById = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('chit_group_id')
      .populate('winner_id', 'full_name');
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    const bids = await Bid.find({ auction_id: auction._id }).populate('user_id', 'full_name').sort({ bid_amount: -1 }).limit(50);

    const userId = req.user._id || req.user.id;
    const userBidCount = await Bid.countDocuments({ auction_id: auction._id, user_id: userId });
    const walletBalance = await walletController.getAvailableBalance(userId);

    // Calculate max bid info
    const cg = auction.chit_group_id;
    const cv = cg?.chit_value || 0;
    const cPct = cg?.foreman_commission_percentage || 5;
    const comm = Math.round(cv * (cPct / 100));
    const pool = cv - comm;
    const maxBid = Math.round(pool * 0.30);

    const data = {
      ...auction.toObject(),
      chitGroup: auction.chit_group_id,
      bids,
      status: normalizeStatus(auction.status),
      user_bid_count: userBidCount,
      wallet_balance: walletBalance,
      commission: comm,
      auction_pool: pool,
      max_bid_amount: maxBid,
    };

    // Inject live timer data
    if (timerManager.isActive(auction._id)) {
      data.server_time_remaining = timerManager.getTimeRemaining(auction._id);
      data.server_end_time = timerManager.getEndTime(auction._id)?.toISOString();
      data.active_users = timerManager.getActiveUserCount(auction._id);
    } else if (data.status === 'active' && auction.end_time) {
      // Timer not in memory (server restarted) — compute from DB end_time
      const remaining = Math.max(0, Math.floor((new Date(auction.end_time) - Date.now()) / 1000));
      data.server_time_remaining = remaining;
      data.server_end_time = auction.end_time;
      data.active_users = 0;
      // Auto-restore the timer so socket ticks resume
      if (remaining > 0) {
        timerManager.startTimer(
          auction._id,
          new Date(auction.end_time),
          auction.anti_snipe_seconds || 15,
          auction.anti_snipe_extension || 30,
        );
      }
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getAuctionBids = async (req, res, next) => {
  try {
    const bids = await Bid.find({ auction_id: req.params.id })
      .populate('user_id', 'full_name')
      .sort({ bid_amount: -1 });
    const data = bids.map(b => ({ ...b.toObject(), bidder: b.user_id }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getLiveAuctionStatus = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id).populate('chit_group_id', 'group_name chit_value');
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });

    const highestBid = await Bid.findOne({ auction_id: auction._id }).sort({ bid_amount: -1 });
    const bidCount = await Bid.countDocuments({ auction_id: auction._id });

    const chitValue = auction.chit_group_id?.chit_value || 0;
    const commissionPct = auction.chit_group_id?.foreman_commission_percentage || 5;
    const commission = Math.round(chitValue * (commissionPct / 100));
    const auctionPool = chitValue - commission;

    const maxBidAmount = Math.round(auctionPool * 0.30);
    const data = {
      auction_id: auction._id,
      status: normalizeStatus(auction.status),
      current_highest_bid: highestBid?.bid_amount || 0,
      total_bids: bidCount,
      chit_value: chitValue,
      commission,
      auction_pool: auctionPool,
      max_bid_amount: maxBidAmount,
      min_bid_increment: auction.min_bid_increment || 100,
      bid_fee: auction.bid_fee || 0,
      anti_snipe_seconds: auction.anti_snipe_seconds || 15,
    };

    // Server timer data
    if (timerManager.isActive(auction._id)) {
      data.server_time_remaining = timerManager.getTimeRemaining(auction._id);
      data.server_end_time = timerManager.getEndTime(auction._id)?.toISOString();
      data.active_users = timerManager.getActiveUserCount(auction._id);
    } else {
      data.time_remaining = auction.scheduled_end_time ? Math.max(0, new Date(auction.scheduled_end_time) - new Date()) : null;
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── PLACE BID (HIGHEST bid wins + wallet locking) ───
exports.placeBid = async (req, res, next) => {
  try {
    const { bid_amount } = req.body;
    const userId = req.user._id || req.user.id;
    const amount = Number(bid_amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid bid amount' });
    }

    // 1. Load auction
    const auction = await Auction.findById(req.params.id).populate('chit_group_id');
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (auction.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Auction is not live' });

    // 2. Check server timer — auction must still have time
    if (timerManager.isActive(auction._id) && timerManager.getTimeRemaining(auction._id) <= 0) {
      return res.status(400).json({ success: false, message: 'Auction time has expired' });
    }

    // 3. Rate limiting — max 1 bid per 3 seconds
    if (!timerManager.checkBidRateLimit(auction._id, userId)) {
      return res.status(429).json({ success: false, message: 'Too fast! Wait 3 seconds between bids' });
    }

    // 4. Membership check
    const membership = await ChitMember.findOne({ chit_group_id: auction.chit_group_id._id || auction.chit_group_id, user_id: userId });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this group' });
    if (membership.has_won_auction) return res.status(400).json({ success: false, message: 'You have already won an auction in this group' });

    // 5. Max bids per user check
    if (auction.max_bids_per_user > 0) {
      const userBidCount = await Bid.countDocuments({ auction_id: auction._id, user_id: userId });
      if (userBidCount >= auction.max_bids_per_user) {
        return res.status(400).json({ success: false, message: `Maximum ${auction.max_bids_per_user} bids allowed per user` });
      }
    }

    // 6. Calculate auction_pool and max bid cap (30% of auction pool)
    const chitGroup = auction.chit_group_id;
    const chitValue = chitGroup?.chit_value || 0;
    const commissionPct = chitGroup?.foreman_commission_percentage || 5;
    const commission = Math.round(chitValue * (commissionPct / 100));
    const auctionPool = chitValue - commission;
    const maxBidAmount = Math.round(auctionPool * 0.30); // Members can bid max 30% of auction pool

    if (amount > maxBidAmount) {
      return res.status(400).json({ success: false, message: `Bid cannot exceed 30% of auction pool (max ₹${maxBidAmount.toLocaleString('en-IN')})` });
    }

    // 7. Must be HIGHER than current highest bid
    const currentHighest = await Bid.findOne({ auction_id: auction._id }).sort({ bid_amount: -1 }).select('bid_amount user_id').lean();
    if (currentHighest && amount <= currentHighest.bid_amount) {
      return res.status(400).json({
        success: false,
        message: `Bid must be higher than current highest ₹${currentHighest.bid_amount.toLocaleString('en-IN')}`,
      });
    }

    // 7b. Bid-once-until-outbid: if you are currently the highest bidder, you cannot bid again
    if (currentHighest && String(currentHighest.user_id) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already the highest bidder. Wait until someone outbids you.',
      });
    }

    // 8. Minimum increment check
    const minIncrement = auction.min_bid_increment || 0;
    if (minIncrement > 0 && currentHighest && (amount - currentHighest.bid_amount) < minIncrement) {
      return res.status(400).json({
        success: false,
        message: `Bid must be at least ₹${minIncrement} more than current highest`,
      });
    }

    // 9. Duplicate bid check — same user, same amount
    const duplicateBid = await Bid.findOne({ auction_id: auction._id, user_id: userId, bid_amount: amount });
    if (duplicateBid) {
      return res.status(400).json({ success: false, message: 'You already placed a bid with this amount' });
    }

    // 10. Bid fee deduction (if applicable) — bid amount itself is NOT locked
    // In chit funds, the bid is a sacrifice from the payout, not money from wallet
    const bidFee = auction.bid_fee || 0;
    if (bidFee > 0) {
      const walletResult = await walletController.deductBidFee(userId, bidFee, auction._id);
      if (!walletResult.success) {
        return res.status(400).json({ success: false, message: walletResult.message });
      }
    }

    // 11. Create bid
    const bidTimeMs = Date.now();
    const bid = await Bid.create({
      auction_id: auction._id,
      user_id: userId,
      ticket_number: membership.ticket_number,
      bid_amount: amount,
      bid_time_ms: bidTimeMs,
      bid_fee_charged: bidFee,
      ip_address: req.ip,
    });

    // 12. Update auction stats (atomic)
    await Auction.findByIdAndUpdate(auction._id, {
      current_highest_bid: amount,
      $inc: { total_bid_count: 1 },
    });

    // 13. Check anti-sniping
    const antiSnipeResult = timerManager.checkAntiSnipe(auction._id);
    if (antiSnipeResult.extended) {
      await Auction.findByIdAndUpdate(auction._id, {
        scheduled_end_time: antiSnipeResult.newEndTime,
        end_time: antiSnipeResult.newEndTime,
      });
    }

    // 14. Broadcast to all clients in auction room
    const io = req.app.get('io');
    if (io) {
      const bidData = {
        auction_id: String(auction._id),
        bid_amount: amount,
        bidder_name: req.user.full_name,
        user_id: String(userId),
        ticket_number: membership.ticket_number,
        timestamp: new Date().toISOString(),
        bid_time_ms: bidTimeMs,
        total_bids: (auction.total_bid_count || 0) + 1,
        anti_snipe_extended: antiSnipeResult.extended,
      };
      if (antiSnipeResult.extended) {
        bidData.new_end_time = antiSnipeResult.newEndTime.toISOString();
        bidData.extension_seconds = antiSnipeResult.extensionSeconds;
      }
      io.to('auction:' + auction._id).emit('new_bid', bidData);
    }

    // 15. Get updated available wallet balance
    const walletBalance = await walletController.getAvailableBalance(userId);

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully',
      data: {
        bid,
        anti_snipe_extended: antiSnipeResult.extended,
        wallet_balance: walletBalance,
        server_time_remaining: timerManager.getTimeRemaining(auction._id),
      },
    });
  } catch (err) { next(err); }
};

exports.createAuction = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (!body.auction_date && body.start_time) body.auction_date = body.start_time;
    const auction = await Auction.create(body);
    res.status(201).json({ success: true, message: 'Auction created', data: auction });
  } catch (err) { next(err); }
};

// ─── START AUCTION (with server-controlled timer) ───
exports.startAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id).populate('chit_group_id', 'group_name chit_value');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Auction is not in scheduled status' });

    // Calculate end time from duration
    const now = new Date();
    const durationMs = (auction.duration_minutes || 30) * 60 * 1000;
    const endTime = auction.end_time || new Date(now.getTime() + durationMs);

    // Update auction in DB
    await Auction.findByIdAndUpdate(auction._id, {
      status: 'in_progress',
      actual_start_time: now,
      scheduled_end_time: endTime,
      end_time: endTime,
    });

    // Start server-controlled timer
    timerManager.startTimer(
      auction._id,
      endTime,
      auction.anti_snipe_seconds || 15,
      auction.anti_snipe_extension || 30,
    );

    const io = req.app.get('io');
    if (io) {
      const payload = {
        auction_id: String(auction._id),
        group_name: auction.chit_group_id?.group_name,
        chit_value: auction.chit_group_id?.chit_value,
        status: 'active',
        server_end_time: endTime.toISOString(),
        duration_minutes: auction.duration_minutes || 30,
        min_bid_increment: auction.min_bid_increment || 100,
        bid_fee: auction.bid_fee || 0,
        anti_snipe_seconds: auction.anti_snipe_seconds || 15,
      };
      io.to('auction:' + auction._id).emit('auction_started', payload);
      io.emit('auction_status_changed', payload);
    }

    const updated = await Auction.findById(auction._id).populate('chit_group_id', 'group_name');
    res.json({ success: true, message: 'Auction started', data: { ...updated.toObject(), server_end_time: endTime.toISOString() } });
  } catch (err) { next(err); }
};

// ─── PAUSE AUCTION ───
exports.pauseAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Auction is not in progress' });

    const remaining = timerManager.getTimeRemaining(auction._id);
    timerManager.stopTimer(auction._id);

    await Auction.findByIdAndUpdate(auction._id, {
      status: 'paused',
      paused_time_remaining: remaining,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('auction:' + auction._id).emit('auction_paused', {
        auction_id: String(auction._id),
        remaining_seconds: remaining,
      });
      io.emit('auction_status_changed', { auction_id: String(auction._id), status: 'paused' });
    }

    res.json({ success: true, message: 'Auction paused', data: { remaining_seconds: remaining } });
  } catch (err) { next(err); }
};

// ─── RESUME AUCTION ───
exports.resumeAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    if (auction.status !== 'paused') return res.status(400).json({ success: false, message: 'Auction is not paused' });

    const remaining = auction.paused_time_remaining || 60;
    const newEndTime = new Date(Date.now() + remaining * 1000);

    timerManager.startTimer(
      auction._id,
      newEndTime,
      auction.anti_snipe_seconds || 15,
      auction.anti_snipe_extension || 30,
    );

    await Auction.findByIdAndUpdate(auction._id, {
      status: 'in_progress',
      end_time: newEndTime,
      scheduled_end_time: newEndTime,
      paused_time_remaining: 0,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('auction:' + auction._id).emit('auction_resumed', {
        auction_id: String(auction._id),
        remaining_seconds: remaining,
        end_time: newEndTime.toISOString(),
      });
      io.emit('auction_status_changed', { auction_id: String(auction._id), status: 'in_progress' });
    }

    res.json({ success: true, message: 'Auction resumed', data: { remaining_seconds: remaining, end_time: newEndTime } });
  } catch (err) { next(err); }
};

// ─── END AUCTION (manual or auto via timer) ───
exports.endAuction = async (req, res, next) => {
  try {
    await endAuctionById(req.params.id, req.app.get('io'));
    const updated = await Auction.findById(req.params.id).populate('winner_id', 'full_name mobile');
    res.json({ success: true, message: 'Auction ended', data: updated });
  } catch (err) { next(err); }
};

// Shared function for ending auction (used by both manual end and timer expiry)
const endAuctionById = async (auctionId, io) => {
  const auction = await Auction.findById(auctionId).populate('chit_group_id');
  if (!auction || auction.status === 'completed') return;

  // Stop the timer
  timerManager.stopTimer(auctionId);

  const chitGroup = auction.chit_group_id;
  const chitValue = chitGroup?.chit_value || 0;
  const totalMembers = chitGroup?.total_members || 1;
  const commissionPct = chitGroup?.foreman_commission_percentage || 5;

  // HIGHEST bid wins (tie-break: earliest timestamp with ms precision)
  const winningBid = await Bid.findOne({ auction_id: auction._id }).sort({ bid_amount: -1, bid_time_ms: 1 });

  const updateData = {
    status: 'completed',
    actual_end_time: new Date(),
  };

  if (winningBid) {
    // ── Commission & Settlement (per spec) ──
    // commission = chit_value × 5% (taken ONCE)
    const commission = Math.round(chitValue * (commissionPct / 100));
    // winner_amount = chit_value - commission - winning_bid
    const winnerAmount = Math.max(0, chitValue - commission - winningBid.bid_amount);
    // dividend = winning_bid / total_members
    const dividendPerMember = totalMembers > 0 ? Math.round(winningBid.bid_amount / totalMembers) : 0;

    updateData.winner_id = winningBid.user_id;
    updateData.winning_bid_amount = winningBid.bid_amount;
    updateData.commission_amount = commission;
    updateData.discount_amount = winningBid.bid_amount; // the sacrifice amount (bid)
    updateData.dividend_amount = winningBid.bid_amount; // total dividend pool = winning bid
    updateData.dividend_per_member = dividendPerMember;
    updateData.disbursement_amount = winnerAmount; // winner gets this amount

    // Mark winning bid
    await Bid.findByIdAndUpdate(winningBid._id, { is_winning_bid: true });
    await ChitMember.findOneAndUpdate(
      { chit_group_id: auction.chit_group_id._id, user_id: winningBid.user_id },
      { has_won_auction: true, auction_won_month: auction.month_number },
    );

    // ── Credit winner's disbursement to wallet ──
    // Winner gets: chit_value - commission - winning_bid
    if (winnerAmount > 0) {
      const winnerWallet = await walletController.getOrCreateWallet(winningBid.user_id);
      const newWinnerBalance = winnerWallet.balance + winnerAmount;
      await Wallet.findByIdAndUpdate(winnerWallet._id, { balance: newWinnerBalance });
      await WalletTransaction.create({
        user_id: winningBid.user_id,
        wallet_id: winnerWallet._id,
        type: 'auction_winning',
        amount: winnerAmount,
        balance_after: newWinnerBalance,
        description: `Auction winning - ${chitGroup.group_name} Month ${auction.month_number} (Chit ₹${chitValue} - Commission ₹${commission} - Bid ₹${winningBid.bid_amount})`,
        reference_id: String(auction._id),
      });
      logger.info(`Winner ${winningBid.user_id} credited ₹${winnerAmount}`);
    }

    // ── Distribute Dividend to All Members' Wallets ──
    if (dividendPerMember > 0) {
      const members = await ChitMember.find({ chit_group_id: chitGroup._id, is_active: true });
      for (const member of members) {
        try {
          const wallet = await walletController.getOrCreateWallet(member.user_id);
          const newBalance = wallet.balance + dividendPerMember;
          await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance });
          await WalletTransaction.create({
            user_id: member.user_id,
            wallet_id: wallet._id,
            type: 'dividend',
            amount: dividendPerMember,
            balance_after: newBalance,
            description: `Dividend from ${chitGroup.group_name} - Month ${auction.month_number} auction`,
            reference_id: String(auction._id),
          });
        } catch (err) {
          logger.error(`Failed to credit dividend to member ${member.user_id}: ${err.message}`);
        }
      }
      logger.info(`Dividends distributed: ₹${dividendPerMember} × ${members.length} members = ₹${dividendPerMember * members.length}`);
    }

    logger.info(`Auction ${auctionId} | Commission: ₹${commission} | Winning Bid: ₹${winningBid.bid_amount} | Winner gets: ₹${winnerAmount} | Dividend/member: ₹${dividendPerMember}`);
  }

  await Auction.findByIdAndUpdate(auction._id, updateData);

  const updated = await Auction.findById(auction._id)
    .populate('winner_id', 'full_name mobile')
    .populate('chit_group_id', 'group_name chit_value');

  if (io) {
    const payload = {
      auction_id: String(auction._id),
      winner_name: updated?.winner_id?.full_name || 'No winner',
      winning_amount: winningBid?.bid_amount || 0,
      commission: updateData.commission_amount || 0,
      dividend_per_member: updateData.dividend_per_member || 0,
      disbursement_amount: updateData.disbursement_amount || 0,
      status: 'completed',
      total_bids: auction.total_bid_count || 0,
    };
    io.to('auction:' + auction._id).emit('auction_ended', payload);
    io.emit('auction_status_changed', payload);
  }

  logger.info(`Auction ${auctionId} ended. Winner: ${updated?.winner_id?.full_name || 'none'}, Amount: ${winningBid?.bid_amount || 0}`);
};

// Export for use by timer manager
exports.endAuctionById = endAuctionById;

exports.approveDisbursement = async (req, res, next) => {
  try {
    const auction = await Auction.findByIdAndUpdate(req.params.id, { disbursement_status: 'approved', disbursement_approved_at: new Date(), disbursement_approved_by: req.user._id || req.user.id }, { new: true }).populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Disbursement approved', data: auction });
  } catch (err) { next(err); }
};

exports.disburseAmount = async (req, res, next) => {
  try {
    const { utr_number } = req.body;
    const auction = await Auction.findByIdAndUpdate(req.params.id, { disbursement_status: 'disbursed', utr_number, disbursement_date: new Date() }, { new: true }).populate('winner_id', 'full_name mobile');
    if (!auction) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Amount disbursed', data: auction });
  } catch (err) { next(err); }
};
