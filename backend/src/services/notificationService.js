'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// ─── MSG91 OTP ───────────────────────────────────────────────────────────────

/**
 * Send OTP via MSG91 with DLT-approved template
 */
exports.sendOTP = async (mobile, otp) => {
  if (!process.env.MSG91_AUTH_KEY) {
    throw new Error('MSG91_AUTH_KEY must be set in .env');
  }

  const sender = process.env.MSG91_SENDER_ID || 'ACFUND';
  let url = `https://api.msg91.com/api/v5/otp?authkey=${process.env.MSG91_AUTH_KEY}&mobile=91${mobile}&otp=${otp}&otp_expiry=10&otp_length=6&sender=${sender}`;
  if (process.env.MSG91_TEMPLATE_ID) {
    url += `&template_id=${process.env.MSG91_TEMPLATE_ID}`;
  }

  try {
    const https = require('https');
    const result = await new Promise((resolve, reject) => {
      https.get(url, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      }).on('error', reject);
    });

    if (result.type === 'success') {
      logger.info(`OTP sent via MSG91 to ${mobile} (request_id: ${result.request_id})`);
      return result;
    }

    logger.error('MSG91 OTP failed:', JSON.stringify(result));
    throw new Error(`MSG91 OTP error: ${result.message || JSON.stringify(result)}`);
  } catch (err) {
    logger.error('MSG91 OTP exception:', err.message);
    throw err;
  }
};

// ─── MSG91 SMS (non-OTP) ─────────────────────────────────────────────────────

/**
 * Send a transactional SMS via MSG91 flow
 */
exports.sendSMS = async (mobile, message) => {
  if (!process.env.MSG91_AUTH_KEY) {
    logger.warn('MSG91_AUTH_KEY not set — skipping SMS');
    return;
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': process.env.MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        flow_id: process.env.MSG91_SMS_FLOW_ID || process.env.MSG91_TEMPLATE_ID,
        sender: process.env.MSG91_SENDER_ID || 'ASSURE',
        mobiles: `91${mobile}`,
        VAR1: message
      })
    });
    const result = await response.json();
    logger.info(`SMS sent via MSG91 to ${mobile}:`, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error('MSG91 SMS error:', err.message);
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

