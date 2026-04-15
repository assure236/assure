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
      scope: 'openid',
    });

    const authUrl = `${DL_BASE}/public/oauth2/2/authorize?${params.toString()}`;
    console.log('DigiLocker auth URL generated:', authUrl);
    console.log('DigiLocker redirect_uri config:', DL_REDIRECT_URI);
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
      return `assurechitfunds://documents?${params}`;
    }
    return `${webAppUrl}/documents?${params}`;
  };
  let sessionPlatform = 'web';

  try {
    // Log everything DigiLocker sends back for debugging (console.log for PM2 visibility)
    console.log('=== DIGILOCKER CALLBACK ===');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Query:', JSON.stringify(req.query));
    console.log('Body:', JSON.stringify(req.body));
    console.log('Headers host:', req.headers.host);
    console.log('=== END CALLBACK DEBUG ===');

    // DigiLocker may send error on denial or misconfiguration
    if (req.query.error) {
      const errDesc = req.query.error_description || req.query.error;
      console.log('DigiLocker returned error:', req.query.error, errDesc);
      return res.redirect(buildRedirect(sessionPlatform, 'error', errDesc));
    }

    // DigiLocker sends code & state as query params (GET redirect)
    const code = req.query.code || req.body?.code;
    const state = req.query.state || req.body?.state;
    if (!code || !state) {
      console.log('MISSING PARAMS - code:', !!code, 'state:', !!state);
      console.log('All query keys:', Object.keys(req.query));
      console.log('All body keys:', req.body ? Object.keys(req.body) : 'no body');
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

    console.log('DigiLocker token exchange request:', `${DL_BASE}/public/oauth2/2/token`, tokenBody.toString().replace(DL_CLIENT_SECRET, '***'));

    const tokenRes = await fetch(`${DL_BASE}/public/oauth2/2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    const tokenText = await tokenRes.text();
    console.log('DigiLocker token response:', tokenRes.status, tokenText);

    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = {}; }

    if (!tokenData.access_token) {
      console.error('DigiLocker token exchange failed:', tokenRes.status, tokenText);
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

    console.log('DigiLocker user details:', { digilockerId, dlName, dlDob, dlGender, dlMobile, dlEaadhaar });

    // Parse scope to find which documents were consented
    // e.g. "files.issueddocs issued/in.gov.pan-PANCR-HRVPP2182R userdetails"
    const scope = tokenData.scope || '';
    const scopeParts = scope.split(' ');
    console.log('DigiLocker scope:', scope);

    // Extract PAN number from scope (issued/in.gov.pan-PANCR-XXXXXXXXXX)
    let panFromScope = null;
    for (const part of scopeParts) {
      const panMatch = part.match(/PANCR-([A-Z0-9]+)/i);
      if (panMatch) panFromScope = panMatch[1];
    }
    console.log('PAN from scope:', panFromScope);

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
    console.log('User updated with DigiLocker data:', JSON.stringify(userUpdate));

    // Fetch Aadhaar eKYC data (may return 403 if not in scope)
    let ekyc = null;
    if (dlEaadhaar) {
      try {
        const ekycRes = await fetch(`${DL_BASE}/public/oauth2/2/xml/eaadhaar`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log('DigiLocker eKYC response:', ekycRes.status);
        if (ekycRes.ok) {
          ekyc = await ekycRes.text();
          console.log('DigiLocker eKYC data length:', ekyc.length);
        } else {
          const ekycErr = await ekycRes.text();
          console.log('DigiLocker eKYC error body:', ekycErr);
        }
      } catch (e) {
        console.warn('DigiLocker eKYC fetch failed:', e.message);
      }
    }

    // Fetch issued documents list (v1 API)
    let issuedDocs = [];
    try {
      const docsRes = await fetch(`${DL_BASE}/public/oauth2/2/files/issued`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('DigiLocker issued docs response:', docsRes.status);
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        console.log('DigiLocker issued docs:', JSON.stringify(docsData));
        issuedDocs = docsData.items || docsData.documents || [];
      } else {
        const docsErr = await docsRes.text();
        console.log('DigiLocker issued docs error:', docsErr);
      }
    } catch (e) {
      console.warn('DigiLocker docs fetch failed:', e.message);
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
        console.log('Created document from issued docs:', docType);
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
        console.log('Created PAN document from scope:', panFromScope);
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
        console.log('Created Aadhaar document from eaadhaar flag');
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

        // SMS notification
        if (verifiedUser?.mobile) {
          notificationService.sendSMS(verifiedUser.mobile, `Congratulations ${userName}! Your KYC verification is complete via DigiLocker. You can now access all features on Assure ChitFunds.`).catch(err => console.error('KYC SMS failed:', err.message));
        }

        // Email notification
        if (verifiedUser?.email) {
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #1a73e8;">Assure ChitFunds</h1>
              </div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center;">
                <h2 style="color: #16a34a;">✅ KYC Verification Complete</h2>
                <p style="color: #333; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
                <p style="color: #555;">Your identity has been successfully verified through DigiLocker. Your Aadhaar and PAN details are now confirmed.</p>
                <p style="color: #555;">You can now enjoy full access to all features on Assure ChitFunds.</p>
              </div>
              <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Assure ChitFunds. Please do not reply.</p>
            </div>
          `;
          notificationService.sendEmail(verifiedUser.email, 'KYC Verification Complete - Assure ChitFunds', emailHtml).catch(err => console.error('KYC email failed:', err.message));
        }

        console.log('KYC verification notifications dispatched for user:', userId);
      } catch (notifErr) {
        console.error('KYC notification dispatch error (non-blocking):', notifErr.message);
      }
    }

    // Redirect back to app with success
    return res.redirect(buildRedirect(sessionPlatform, 'success'));
  } catch (err) {
    console.error('DigiLocker callback error:', err);
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
