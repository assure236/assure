const logger = require('../utils/logger');

/**
 * AuctionTimerManager — Server-side timer control for live auctions
 * 
 * - Manages countdown timers in-memory (no Redis needed for single-server)
 * - Broadcasts timer_tick every second to all clients in auction room
 * - Handles anti-sniping (extend timer on last-second bids)
 * - Auto-ends auction when timer reaches 0
 * - Tracks active users per auction
 */
class AuctionTimerManager {
  constructor() {
    // Map<auctionId, { endTime: Date, interval: NodeJS.Timer, antiSnipeSeconds, antiSnipeExtension }>
    this.timers = new Map();
    // Map<auctionId, Set<socketId>> — track active users
    this.activeUsers = new Map();
    // Map<auctionId, Map<userId, lastBidTime>> — rate limiting
    this.bidRateLimits = new Map();
    // Reference to Socket.IO instance
    this.io = null;
    // Callback when timer expires
    this.onTimerExpired = null;
  }

  /**
   * Initialize with Socket.IO instance and expiry callback
   */
  init(io, onTimerExpired) {
    this.io = io;
    this.onTimerExpired = onTimerExpired;
  }

  /**
   * Start a timer for an auction
   * @param {string} auctionId 
   * @param {Date} endTime — when the auction should end
   * @param {number} antiSnipeSeconds — if bid within last N seconds, extend (default 15)
   * @param {number} antiSnipeExtension — extend by N seconds (default 30)
   */
  startTimer(auctionId, endTime, antiSnipeSeconds = 15, antiSnipeExtension = 30) {
    // Clear existing timer if any
    this.stopTimer(auctionId);

    const id = String(auctionId);
    const timerData = {
      endTime: new Date(endTime),
      antiSnipeSeconds,
      antiSnipeExtension,
      interval: null,
    };

    // Broadcast every second
    timerData.interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((timerData.endTime - Date.now()) / 1000));

      if (this.io) {
        this.io.to(`auction:${id}`).emit('timer_tick', {
          auction_id: id,
          remaining_seconds: remaining,
          end_time: timerData.endTime.toISOString(),
          active_users: this.getActiveUserCount(id),
        });

        // Time-up warnings at specific thresholds
        const warnings = [300, 120, 60, 30, 10];
        if (warnings.includes(remaining)) {
          const label = remaining >= 60 ? `${Math.floor(remaining / 60)} minute${remaining >= 120 ? 's' : ''}` : `${remaining} seconds`;
          this.io.to(`auction:${id}`).emit('time_warning', {
            auction_id: id,
            remaining_seconds: remaining,
            message: `Hurry! Only ${label} left!`,
            urgency: remaining <= 30 ? 'critical' : remaining <= 60 ? 'high' : 'medium',
          });
        }
      }

      // Auto-end when timer reaches 0
      if (remaining <= 0) {
        this.stopTimer(id);
        logger.info(`Auction ${id} timer expired — auto-ending`);
        if (this.onTimerExpired) {
          this.onTimerExpired(id);
        }
      }
    }, 1000);

    this.timers.set(id, timerData);
    logger.info(`Timer started for auction ${id}, ends at ${timerData.endTime.toISOString()}`);
  }

  /**
   * Stop and clean up timer for an auction
   */
  stopTimer(auctionId) {
    const id = String(auctionId);
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer.interval);
      this.timers.delete(id);
      this.bidRateLimits.delete(id);
      logger.info(`Timer stopped for auction ${id}`);
    }
  }

  /**
   * Check if bid triggers anti-snipe extension
   * Returns { extended: boolean, newEndTime?: Date, extensionSeconds?: number }
   */
  checkAntiSnipe(auctionId) {
    const id = String(auctionId);
    const timer = this.timers.get(id);
    if (!timer) return { extended: false };

    const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));

    if (remaining > 0 && remaining <= timer.antiSnipeSeconds) {
      // Extend the timer
      const extensionMs = timer.antiSnipeExtension * 1000;
      timer.endTime = new Date(timer.endTime.getTime() + extensionMs);

      logger.info(`Anti-snipe triggered for auction ${id}: extended by ${timer.antiSnipeExtension}s, new end: ${timer.endTime.toISOString()}`);

      // Broadcast extension event
      if (this.io) {
        this.io.to(`auction:${id}`).emit('timer_extended', {
          auction_id: id,
          new_end_time: timer.endTime.toISOString(),
          extension_seconds: timer.antiSnipeExtension,
          reason: 'Anti-snipe: bid placed in final seconds',
        });
      }

      return {
        extended: true,
        newEndTime: timer.endTime,
        extensionSeconds: timer.antiSnipeExtension,
      };
    }

    return { extended: false };
  }

  /**
   * Get remaining time in seconds for an auction
   */
  getTimeRemaining(auctionId) {
    const timer = this.timers.get(String(auctionId));
    if (!timer) return 0;
    return Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
  }

  /**
   * Get end time for an auction
   */
  getEndTime(auctionId) {
    const timer = this.timers.get(String(auctionId));
    return timer ? timer.endTime : null;
  }

  /**
   * Check if timer is active
   */
  isActive(auctionId) {
    return this.timers.has(String(auctionId));
  }

  // ============ ACTIVE USERS TRACKING ============

  /**
   * Track user joining auction room
   */
  userJoined(auctionId, socketId) {
    const id = String(auctionId);
    if (!this.activeUsers.has(id)) {
      this.activeUsers.set(id, new Set());
    }
    this.activeUsers.get(id).add(socketId);
    this._broadcastUserCount(id);
  }

  /**
   * Track user leaving auction room
   */
  userLeft(auctionId, socketId) {
    const id = String(auctionId);
    const users = this.activeUsers.get(id);
    if (users) {
      users.delete(socketId);
      if (users.size === 0) this.activeUsers.delete(id);
      this._broadcastUserCount(id);
    }
  }

  /**
   * Remove socket from all auctions (on disconnect)
   */
  userDisconnected(socketId) {
    for (const [auctionId, users] of this.activeUsers.entries()) {
      if (users.has(socketId)) {
        users.delete(socketId);
        if (users.size === 0) {
          this.activeUsers.delete(auctionId);
        }
        this._broadcastUserCount(auctionId);
      }
    }
  }

  /**
   * Get active user count for an auction
   */
  getActiveUserCount(auctionId) {
    const users = this.activeUsers.get(String(auctionId));
    return users ? users.size : 0;
  }

  _broadcastUserCount(auctionId) {
    if (this.io) {
      this.io.to(`auction:${auctionId}`).emit('active_users_update', {
        auction_id: auctionId,
        count: this.getActiveUserCount(auctionId),
      });
    }
  }

  // ============ RATE LIMITING ============

  /**
   * Check if user can bid (rate limit: 1 bid per 3 seconds)
   * @returns {boolean} true if allowed
   */
  checkBidRateLimit(auctionId, userId) {
    const id = String(auctionId);
    const uid = String(userId);

    if (!this.bidRateLimits.has(id)) {
      this.bidRateLimits.set(id, new Map());
    }

    const auctionLimits = this.bidRateLimits.get(id);
    const lastBid = auctionLimits.get(uid);
    const now = Date.now();

    if (lastBid && (now - lastBid) < 3000) {
      return false; // Too soon
    }

    auctionLimits.set(uid, now);
    return true;
  }

  /**
   * Get all active auction IDs
   */
  getActiveAuctions() {
    return Array.from(this.timers.keys());
  }

  /**
   * Clean up everything
   */
  destroy() {
    for (const [id] of this.timers) {
      this.stopTimer(id);
    }
    this.activeUsers.clear();
    this.bidRateLimits.clear();
  }
}

// Singleton instance
const timerManager = new AuctionTimerManager();
module.exports = timerManager;
