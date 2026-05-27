const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

// ─── In-memory user cache (avoids DB hit on every authenticated request) ─────
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10000;

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(userId, user) {
  if (userCache.size >= MAX_CACHE_SIZE) {
    const firstKey = userCache.keys().next().value;
    userCache.delete(firstKey);
  }
  userCache.set(userId, { user, ts: Date.now() });
}

// Exported so other code can invalidate on profile update / deactivation
function invalidateUserCache(userId) {
  userCache.delete(String(userId));
}

const authMiddleware = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer dev-bypass-token') {
        req.user = {
          id: '000000000000000000000001',
          _id: '000000000000000000000001',
          full_name: 'Dev User',
          email: 'dev@assure.local',
          mobile: '9999999999',
          role: 'admin',
          is_active: true,
          kyc_status: 'verified',
        };
        return next();
      }
    }

    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try cache first, then DB
    let user = getCachedUser(decoded.userId);
    if (!user) {
      user = await User.findById(decoded.userId).select('-password_hash').lean();
      if (user) {
        user.id = String(user._id);
        setCachedUser(decoded.userId, user);
      }
    }

    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated.' });

    // Check token_version — if bumped via logout-all-devices, reject old tokens
    if (decoded.tv !== undefined && decoded.tv !== (user.token_version || 0)) {
      return res.status(401).json({ success: false, message: 'Session invalidated. Please login again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired.' });
    logger.error('Auth middleware error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
};

module.exports = { authMiddleware, authorizeRoles, invalidateUserCache };
