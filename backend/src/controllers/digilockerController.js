const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Document } = require('../models');
const logger = require('../utils/logger');
const { notifyUser } = require('../utils/notifyUser');
const notificationService = require('../services/notificationService');

// DigiLocker OAuth2 config — set these in .env
const DL_BASE = process.env.DIGILOCKER_BASE_URL || 'https://api.digitallocker.gov.in';
const DL_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || '';
const DL_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';
const DL_REDIRECT_URI = process.env.DIGILOCKER_REDIRECT_URI || '';

// Persistent store for PKCE verifiers (survives server restart)
const dlSessionSchema = new mongoose.Schema({
  state: { type: String, required: true, unique: true },
  code_verifier: { type: String, required: true },
  user_id: { type: String, required: true },
  platform: { type: String, default: 'web' },
  expires_at: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });
const DLSession = mongoose.models.DLSession || mongoose.model('DLSession', dlSessionSchema);

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Step 1: Get DigiLocker authorization URL
 */
exports.getAuthUrl = async (req, res, next) => {
  try {
    if (!DL_CLIENT_ID || DL_CLIENT_ID.startsWith('your_')) {
      return res.status(503).json({ success: false, message: 'DigiLocker verification will be available soon. Please verify your identity using PAN and Aadhaar upload.' });
    }

    const userId = String(req.user._id || req.user.id);
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Detect platform (mobile apps send ?platform=mobile)
    const platform = req.query.platform || 'web';

    // Store verifier in database (expires in 10 min via TTL index)
    await DLSession.create({ state, code_verifier: codeVerifier, user_id: userId, platform, expires_at: new Date(Date.now() + 10 * 60 * 1000) });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: DL_CLIENT_ID,
      redirect_uri: DL_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${DL_BASE}/public/oauth2/1/authorize?${params.toString()}`;
    logger.info('DigiLocker authorization URL generated successfully');
    res.json({ success: true, data: { auth_url: authUrl, authUrl, state } });
  } catch (err) { next(err); }
};

/**
 * Step 2: Handle DigiLocker callback — browser redirect from DigiLocker (GET)
 * DigiLocker redirects here with ?code=xxx&state=xxx — no auth token present.
 * We look up the user via the state parameter stored in DLSession.
 */
exports.handleCallback = async (req, res, next) => {
  // Helper to build redirect URL based on platform
  const webAppUrl = process.env.WEB_CLIENT_URL || 'https://assure.fund';
  const buildRedirect = (platform, status, msg) => {
    const params = msg ? `digilocker=${status}&message=${encodeURIComponent(msg)}` : `digilocker=${status}`;
    if (platform === 'mobile') {
      return `assurechitfunds://dashboard?${params}`;
    }
    return `${webAppUrl}/documents?${params}`;
  };
  let sessionPlatform = 'web';

  try {
    logger.info('DigiLocker callback received');

    // DigiLocker may send error on denial or misconfiguration
    if (req.query.error) {
      const errDesc = req.query.error_description || req.query.error;
      logger.warn(`DigiLocker returned error: ${req.query.error || 'unknown'}`);
      return res.redirect(buildRedirect(sessionPlatform, 'error', errDesc));
    }

    // DigiLocker sends code & state as query params (GET redirect)
    const code = req.query.code || req.body?.code;
    const state = req.query.state || req.body?.state;
    if (!code || !state) {
      logger.warn(`DigiLocker callback missing required params: code=${Boolean(code)}, state=${Boolean(state)}`);
      return res.redirect(buildRedirect(sessionPlatform, 'error', 'Missing authorization code from DigiLocker'));
    }

    const stored = await DLSession.findOneAndDelete({ state });
    if (!stored) {
      return res.redirect(buildRedirect(sessionPlatform, 'error', 'Session expired. Please try again.'));
    }

    const userId = stored.user_id;
    sessionPlatform = stored.platform || 'web';

    // Exchange code for access token
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: DL_CLIENT_ID,
      client_secret: DL_CLIENT_SECRET,
      redirect_uri: DL_REDIRECT_URI,
      code_verifier: stored.code_verifier,
    });

    const tokenRes = await fetch(`${DL_BASE}/public/oauth2/1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    const tokenText = await tokenRes.text();
    logger.info(`DigiLocker token exchange response status: ${tokenRes.status}`);

    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = {}; }

    if (!tokenData.access_token) {
      logger.error(`DigiLocker token exchange failed with status ${tokenRes.status}`);
      return res.redirect(buildRedirect(sessionPlatform, 'error', 'Failed to authenticate with DigiLocker'));
    }

    const accessToken = tokenData.access_token;
    const digilockerId = tokenData.digilockerid || tokenData.digilocker_id || tokenData.sub || null;

    // Token response includes user details — save them directly
    const dlName = tokenData.name || null;
    const dlDob = tokenData.dob || null; // format: DDMMYYYY
    const dlGender = tokenData.gender || null; // M/F
    const dlMobile = tokenData.mobile || null;
    const dlEaadhaar = tokenData.eaadhaar === 'Y';

    // Parse scope to find which documents were consented
    // e.g. "files.issueddocs issued/in.gov.pan-PANCR-HRVPP2182R userdetails"
    const scope = tokenData.scope || '';
    const scopeParts = scope.split(' ');

    // Extract PAN number from scope (issued/in.gov.pan-PANCR-XXXXXXXXXX)
    let panFromScope = null;
    for (const part of scopeParts) {
      const panMatch = part.match(/PANCR-([A-Z0-9]+)/i);
      if (panMatch) panFromScope = panMatch[1];
    }

    // Build user update: save DigiLocker profile data
    const userUpdate = { digilocker_id: digilockerId };
    if (dlName) userUpdate.full_name = dlName; // Update name from DigiLocker
    if (dlDob) {
      // Parse DDMMYYYY to Date
      const day = parseInt(dlDob.substring(0, 2), 10);
      const month = parseInt(dlDob.substring(2, 4), 10) - 1;
      const year = parseInt(dlDob.substring(4, 8), 10);
      userUpdate.date_of_birth = new Date(year, month, day);
    }
    if (dlGender) userUpdate.gender = dlGender === 'M' ? 'male' : dlGender === 'F' ? 'female' : 'other';
    if (panFromScope) userUpdate.pan_number = panFromScope;

    await User.findByIdAndUpdate(userId, userUpdate);

    // Fetch Aadhaar eKYC data (may return 403 if not in scope)
    let ekyc = null;
    if (dlEaadhaar) {
      try {
        const ekycRes = await fetch(`${DL_BASE}/public/oauth2/1/xml/eaadhaar`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        logger.info(`DigiLocker eKYC fetch status: ${ekycRes.status}`);
        if (ekycRes.ok) {
          ekyc = await ekycRes.text();
          logger.info('DigiLocker eKYC data fetched successfully');
        } else {
          await ekycRes.text();
          logger.warn('DigiLocker eKYC fetch returned non-success response');
        }
      } catch (e) {
        logger.warn(`DigiLocker eKYC fetch failed: ${e.message}`);
      }
    }

    // Fetch issued documents list (v1 API)
    let issuedDocs = [];
    try {
      const docsRes = await fetch(`${DL_BASE}/public/oauth2/1/files/issued`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      logger.info(`DigiLocker issued docs fetch status: ${docsRes.status}`);
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        issuedDocs = docsData.items || docsData.documents || [];
      } else {
        await docsRes.text();
        logger.warn('DigiLocker issued docs fetch returned non-success response');
      }
    } catch (e) {
      logger.warn(`DigiLocker docs fetch failed: ${e.message}`);
    }

    // Auto-create document records for Aadhaar/PAN
    const docTypes = {
      ADHAR: 'aadhaar_card',
      PANCR: 'pan_card',
    };

    // From issued docs API response
    for (const doc of issuedDocs) {
      const docType = docTypes[doc.doctype] || docTypes[doc.type];
      if (!docType) continue;

      const exists = await Document.findOne({ user_id: userId, document_type: docType, uploaded_from: 'digilocker' });
      if (!exists) {
        await Document.create({
          user_id: userId,
          document_type: docType,
          document_name: doc.name || `DigiLocker ${docType}`,
          file_url: doc.uri || `digilocker://${doc.doctype}/${doc.id || ''}`,
          uploaded_from: 'digilocker',
          verification_status: 'verified',
          verified_at: new Date(),
          notes: 'Auto-verified via DigiLocker',
        });
        logger.info(`Created DigiLocker document record: ${docType}`);
      }
    }

    // If PAN was in scope but not in issued docs API, create from scope data
    if (panFromScope) {
      const panExists = await Document.findOne({ user_id: userId, document_type: 'pan_card', uploaded_from: 'digilocker' });
      if (!panExists) {
        await Document.create({
          user_id: userId,
          document_type: 'pan_card',
          document_name: `PAN Card - ${panFromScope}`,
          file_url: `digilocker://PANCR/${panFromScope}`,
          uploaded_from: 'digilocker',
          verification_status: 'verified',
          verified_at: new Date(),
          notes: `Auto-verified via DigiLocker. PAN: ${panFromScope}`,
        });
        logger.info('Created DigiLocker PAN document record from scope');
      }
    }

    // If eAadhaar was available (even if XML fetch failed due to scope), mark it
    if (dlEaadhaar) {
      const aadhaarExists = await Document.findOne({ user_id: userId, document_type: 'aadhaar_card', uploaded_from: 'digilocker' });
      if (!aadhaarExists) {
        await Document.create({
          user_id: userId,
          document_type: 'aadhaar_card',
          document_name: `Aadhaar Card - ${dlName || 'DigiLocker Verified'}`,
          file_url: `digilocker://eaadhaar/${digilockerId || ''}`,
          uploaded_from: 'digilocker',
          verification_status: 'verified',
          verified_at: new Date(),
          notes: 'Aadhaar verified via DigiLocker eKYC',
        });
        logger.info('Created DigiLocker Aadhaar document record');
      }
    }

    // Check if all KYC docs are present → auto-verify KYC
    const aadhaarDoc = await Document.findOne({ user_id: userId, document_type: 'aadhaar_card', verification_status: { $in: ['verified', 'approved'] } });
    const panDoc = await Document.findOne({ user_id: userId, document_type: 'pan_card', verification_status: { $in: ['verified', 'approved'] } });

    if (aadhaarDoc && panDoc) {
      await User.findByIdAndUpdate(userId, { kyc_status: 'verified', kyc_verified_at: new Date() });

      // Send KYC verification notifications (fire-and-forget)
      try {
        const verifiedUser = await User.findById(userId).select('full_name email mobile');
        const userName = verifiedUser?.full_name || dlName || 'User';

        // Push notification + in-app (reaches mobile even if verified on web)
        notifyUser(userId, 'KYC Verified! ✅', `Congratulations ${userName}! Your identity has been successfully verified via DigiLocker. You can now access all features.`, 'kyc_update', {});

        // Email notification
        if (verifiedUser?.email) {
          const emailHtml = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
              <div style="background:#0B1F3B;padding:28px;text-align:center">
                <h1 style="color:#D4AF37;margin:0;font-size:22px;letter-spacing:0.5px">Assure ChitFunds</h1>
                <p style="color:#ffffffb3;margin:6px 0 0;font-size:13px">Secure. Transparent. Rewarding.</p>
              </div>
              <div style="padding:32px 28px">
                <div style="text-align:center;margin-bottom:24px">
                  <div style="display:inline-block;background:#f0fdf4;border:2px solid #16a34a;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px">&#x2705;</div>
                </div>
                <h2 style="color:#16a34a;text-align:center;margin:0 0 16px;font-size:20px">KYC Verification Successful!</h2>
                <p style="color:#333;font-size:15px;margin:0 0 12px">Dear <strong>${userName}</strong>,</p>
                <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 16px">We are pleased to inform you that your KYC (Know Your Customer) verification has been successfully completed through DigiLocker. Your Aadhaar and PAN details have been verified and your identity is now confirmed on our platform.</p>
                <div style="background:#f8f9fb;border-left:4px solid #D4AF37;border-radius:6px;padding:16px;margin:0 0 20px">
                  <p style="color:#0B1F3B;font-weight:600;margin:0 0 8px;font-size:14px">You now have full access to:</p>
                  <ul style="color:#555;font-size:14px;margin:0;padding-left:20px;line-height:1.8">
                    <li>Monthly auction bidding &amp; prize eligibility</li>
                    <li>Dividend credits on your installments</li>
                    <li>Prize disbursement to your bank account</li>
                    <li>Enhanced platform features &amp; priority support</li>
                  </ul>
                </div>
                <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 24px">Log in to the Assure ChitFunds app to explore available chit groups and start your savings journey today.</p>
                <div style="text-align:center">
                  <a href="https://assure.fund" style="display:inline-block;background:#0B1F3B;color:#D4AF37;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px">Open the App</a>
                </div>
              </div>
              <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center">
                <p style="color:#999;font-size:11px;margin:0">This is a system-generated email. Please do not reply. For support, contact <a href="mailto:support@assure.fund" style="color:#1E3A8A">support@assure.fund</a></p>
                <p style="color:#bbb;font-size:11px;margin:4px 0 0">&copy; ${new Date().getFullYear()} Assure ChitFunds. All rights reserved.</p>
              </div>
            </div>
          `;
          notificationService.sendEmail(verifiedUser.email, 'KYC Verification Complete - Assure ChitFunds', emailHtml).catch(err => logger.error(`KYC email failed: ${err.message}`));
        }

        logger.info(`KYC verification notifications dispatched for user: ${userId}`);
      } catch (notifErr) {
        logger.error(`KYC notification dispatch error (non-blocking): ${notifErr.message}`);
      }
    }

    // Redirect back to app with success
    return res.redirect(buildRedirect(sessionPlatform, 'success'));
  } catch (err) {
    logger.error(`DigiLocker callback error: ${err.message || String(err)}`);
    return res.redirect(buildRedirect(sessionPlatform, 'error', 'Something went wrong. Please try again.'));
  }
};

/**
 * Check DigiLocker connection status
 */
exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('digilocker_id kyc_status');
    const dlDocs = await Document.find({ user_id: userId, uploaded_from: 'digilocker' }).select('document_type verification_status');

    res.json({
      success: true,
      data: {
        connected: !!user.digilocker_id,
        digilocker_id: user.digilocker_id || null,
        kyc_status: user.kyc_status,
        documents: dlDocs,
      }
    });
  } catch (err) { next(err); }
};
