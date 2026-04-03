'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// ─── Fast2SMS OTP (DLT Route) ────────────────────────────────────────────────

/**
 * Send OTP via Fast2SMS DLT route
 */
exports.sendOTP = async (mobile, otp) => {
  if (!process.env.FAST2SMS_API_KEY) {
    throw new Error('FAST2SMS_API_KEY must be set in .env');
  }

  const template = (process.env.FAST2SMS_MESSAGE_TEMPLATE || 'Your OTP for Assure ChitFunds is {#var#}. Valid for 10 minutes. Do not share with anyone.')
    .replace('{#var#}', otp);

  const body = {
    route: 'dlt',
    sender_id: process.env.FAST2SMS_SENDER_ID || 'ACFUND',
    message: template,
    variables_values: String(otp),
    flash: 0,
    numbers: String(mobile),
    peid: process.env.FAST2SMS_DLT_ENTITY_ID,
    template_id: process.env.FAST2SMS_DLT_TEMPLATE_ID,
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
        message: message,
        flash: 0,
        numbers: String(mobile),
        peid: process.env.FAST2SMS_DLT_ENTITY_ID,
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

// ─── EMAIL (Outlook SMTP) ─────────────────────────────────────────────────────

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: { rejectUnauthorized: false }
    });
  }
  return _transporter;
}

/**
 * Send email via Outlook SMTP
 */
exports.sendEmail = async (to, subject, body) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.warn('SMTP_USER or SMTP_PASSWORD not set — skipping email');
    return;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Assure ChitFunds" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: body
    });
    logger.info(`Email sent via Outlook SMTP to ${to}`);
    return { status: 'success' };
  } catch (err) {
    logger.error('Outlook SMTP error:', err.message);
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

