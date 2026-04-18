const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Record an immutable audit log entry.
 * Non-blocking — errors are logged but never thrown to avoid breaking the main flow.
 */
async function audit({
  userId, userName, userRole,
  action, resourceType, resourceId,
  description, metadata, location, ipAddress,
}) {
  try {
    await AuditLog.create({
      user_id: userId || null,
      user_name: userName,
      user_role: userRole,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      metadata: metadata || {},
      location: location || undefined,
      ip_address: ipAddress,
    });
  } catch (err) {
    logger.error('AuditLog write failed:', err.message);
  }
}

/**
 * Helper to extract IP from Express request.
 */
function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.ip
    || 'unknown';
}

module.exports = { audit, getIp };
