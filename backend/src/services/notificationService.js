'use strict';

const { Resend } = require('resend');
const logger = require('../utils/logger');

// Lazy init — avoids crash when RESEND_API_KEY is not set
let _resend = null;
const getResend = () => {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set in .env');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};

// ─── Fast2SMS OTP (DLT Route) ────────────────────────────────────────────────

/**
 * Send OTP via Fast2SMS DLT route
 */
exports.sendOTP = async (mobile, otp) => {
  if (!process.env.FAST2SMS_API_KEY) {
    throw new Error('FAST2SMS_API_KEY must be set in .env');
  }

  // Use DLT route if template ID is configured, otherwise use Quick Transactional route
  const hasDlt = process.env.FAST2SMS_MESSAGE_ID && !isNaN(parseInt(process.env.FAST2SMS_MESSAGE_ID));

  const body = hasDlt
    ? {
        route: 'dlt',
        sender_id: process.env.FAST2SMS_SENDER_ID,
        message: parseInt(process.env.FAST2SMS_MESSAGE_ID),
        variables_values: String(otp),
        flash: 0,
        numbers: String(mobile),
      }
    : {
        route: 'qt',
        message: `Your Assure ChitFunds OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        language: 'english',
        flash: 0,
        numbers: String(mobile),
      };

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (result.return === true || result.status_code === 200) {
      logger.info(`OTP sent via Fast2SMS to ${mobile} (request_id: ${result.request_id})`);
      return result;
    }

    logger.error('Fast2SMS OTP failed:', JSON.stringify(result));
    throw new Error(`Fast2SMS OTP error: ${result.message || JSON.stringify(result)}`);
  } catch (err) {
    logger.error('Fast2SMS OTP exception:', err.message);
    throw err;
  }
};

// ─── Fast2SMS Transactional SMS ──────────────────────────────────────────────

/**
 * Send a transactional SMS via Fast2SMS
 */
exports.sendSMS = async (mobile, message) => {
  if (!process.env.FAST2SMS_API_KEY) {
    logger.warn('FAST2SMS_API_KEY not set — skipping SMS');
    return;
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'dlt',
        sender_id: process.env.FAST2SMS_SENDER_ID || 'ACFUND',
        message: parseInt(process.env.FAST2SMS_MESSAGE_ID),
        variables_values: message,
        flash: 0,
        numbers: String(mobile),
      }),
    });
    const result = await response.json();
    logger.info(`SMS sent via Fast2SMS to ${mobile}:`, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error('Fast2SMS SMS error:', err.message);
    throw err;
  }
};

// ─── EMAIL (Resend) ───────────────────────────────────────────────────────────

/**
 * Send email via Resend
 */
exports.sendEmail = async (to, subject, body) => {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — skipping email');
    return;
  }

  // Strip HTML tags for plain text version (improves spam score)
  const textBody = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.RESEND_FROM || 'Assure ChitFunds <noreply@assure.fund>',
      reply_to: 'support@assure.fund',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: body,
      text: textBody,
      headers: {
        'X-Entity-Ref-ID': `assure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });

    if (error) {
      logger.error('Resend email error:', JSON.stringify(error));
      throw new Error(error.message || 'Resend email failed');
    }

    logger.info(`Email sent via Resend to ${to} (id: ${data?.id})`);
    return { status: 'success', id: data?.id };
  } catch (err) {
    logger.error('Resend email exception:', err.message);
    throw err;
  }
};

// ─── PUSH NOTIFICATION (stub — wire up FCM later if needed) ──────────────────

exports.sendPushNotification = async (deviceToken, title, body, data = {}) => {
  if (!deviceToken) {
    logger.warn('sendPushNotification: no device token provided, skipping');
    return { success: false, reason: 'no_token' };
  }
  logger.info(`Push notification stub called for token ${deviceToken.slice(0, 12)}...`);
  return { success: false, reason: 'not_configured' };
};

