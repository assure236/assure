const logger = require('../utils/logger');
const timerManager = require('../services/auctionTimerManager');

/**
 * Socket.IO event handler — enhanced with server-controlled timer,
 * active user tracking, and real-time bid validation
 */
module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Track which auctions this socket has joined
    const joinedAuctions = new Set();

    // Join room for user-specific events
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
      logger.info(`User ${userId} joined room`);
    });

    // Join auction room — accepts either plain ID or { auction_id }
    socket.on('join_auction', (payload) => {
      const auctionId = (payload && typeof payload === 'object') ? payload.auction_id : payload;
      socket.join(`auction:${auctionId}`);
      joinedAuctions.add(String(auctionId));

      // Track active user
      timerManager.userJoined(auctionId, socket.id);

      // Send current state to newly joined client
      const remaining = timerManager.getTimeRemaining(auctionId);
      const endTime = timerManager.getEndTime(auctionId);
      socket.emit('auction_sync', {
        auction_id: String(auctionId),
        remaining_seconds: remaining,
        end_time: endTime ? endTime.toISOString() : null,
        active_users: timerManager.getActiveUserCount(auctionId),
        timer_active: timerManager.isActive(auctionId),
      });

      logger.info(`Socket ${socket.id} joined auction ${auctionId} (${timerManager.getActiveUserCount(auctionId)} users)`);
    });

    // Leave auction room — accepts either plain ID or { auction_id }
    socket.on('leave_auction', (payload) => {
      const auctionId = (payload && typeof payload === 'object') ? payload.auction_id : payload;
      socket.leave(`auction:${auctionId}`);
      joinedAuctions.delete(String(auctionId));
      timerManager.userLeft(auctionId, socket.id);
      logger.info(`Socket ${socket.id} left auction ${auctionId}`);
    });

    // Handle bid placement (real-time relay — actual validation is in HTTP controller)
    socket.on('place_bid', async (data) => {
      try {
        const auctionId = data.auctionId || data.auction_id;
        const userId = data.userId || data.user_id;
        const bidAmount = data.bidAmount || data.bid_amount;
        const bidderName = data.bidder_name || data.bidderName || 'Unknown';

        // Rate limit check
        if (!timerManager.checkBidRateLimit(auctionId, userId)) {
          socket.emit('bid_error', { message: 'Too fast! Wait 3 seconds between bids' });
          return;
        }

        // Broadcast new bid to all clients in auction room
        io.to(`auction:${auctionId}`).emit('new_bid', {
          auction_id: String(auctionId),
          user_id: userId,
          bid_amount: Number(bidAmount),
          bidder_name: bidderName,
          timestamp: new Date().toISOString(),
        });

        logger.info(`Bid placed in auction ${auctionId} by user ${userId}: ₹${bidAmount}`);
      } catch (error) {
        logger.error('Error handling bid:', error);
        socket.emit('bid_error', { message: 'Failed to place bid' });
      }
    });

    // Handle disconnect — clean up all auction rooms
    socket.on('disconnect', () => {
      timerManager.userDisconnected(socket.id);
      joinedAuctions.clear();
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  // Helper function to emit to specific user
  io.emitToUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  // Helper function to emit to auction room
  io.emitToAuction = (auctionId, event, data) => {
    io.to(`auction:${auctionId}`).emit(event, data);
  };
};
