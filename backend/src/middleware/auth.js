const jwt = require('jsonwebtoken');
const { User, FamilyMember } = require('../models');
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

async function resolveActiveMemberContext(authUser, requestedMemberId) {
  const memberId = String(requestedMemberId || '').trim().toUpperCase();
  if (!memberId || memberId === 'ME') return { user: authUser, switched: false };
  if ((authUser.member_id || '').toUpperCase() === memberId) {
    return { user: authUser, switched: false };
  }

  const target = await User.findOne({ member_id: memberId, is_active: true })
    .select('-password_hash')
    .lean();
  if (!target) {
    return { user: authUser, switched: false };
  }

  const linkFilter = {
    user_id: authUser._id,
    is_active: true,
    status: { $in: ['approved', 'linked'] },
    $or: [
      { linked_user_id: target._id },
      { member_id: target.member_id },
    ],
  };

  const relation = await FamilyMember.findOne(linkFilter).select('_id').lean();
  if (!relation) {
    return { user: authUser, switched: false };
  }

  target.id = String(target._id);
  return { user: target, switched: true };
}

// Exported so other code can invalidate on profile update / deactivation
function invalidateUserCache(userId) {
  userCache.delete(String(userId));
}

const authMiddleware = async (req, res, next) => {
  try {
    // SECURITY FIX: removed development authentication bypass backdoor.

    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // SECURITY FIX: support HttpOnly auth cookie, reject token in query string.
    if (!token && typeof req.cookies?.['__Host-access_token'] === 'string' && req.cookies['__Host-access_token'].trim()) {
      token = req.cookies['__Host-access_token'].trim();
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

    // For web channel tokens, enforce single active web session.
    if (decoded.ch === 'web') {
      if (decoded.wv !== undefined && decoded.wv !== (user.web_token_version || 0)) {
        return res.status(401).json({ success: false, message: 'Web session invalidated. Please login again.' });
      }
    }

    req.user = user;

    const requestedMemberId =
      req.headers['x-active-member-id'] ||
      req.query?.active_member_id;

    req.auth_user = user;
    req.active_member_context = {
      requested_member_id: requestedMemberId ? String(requestedMemberId).toUpperCase() : null,
      switched: false,
    };

    if (requestedMemberId && user.role === 'member') {
      const resolved = await resolveActiveMemberContext(user, requestedMemberId);
      req.user = resolved.user;
      req.active_member_context.switched = resolved.switched;
    }

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

module.exports = {
  authMiddleware,
  authorizeRoles,
  invalidateUserCache,
  resolveActiveMemberContext,
};
