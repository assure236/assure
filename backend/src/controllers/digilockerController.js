const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Document } = require('../models');
const logger = require('../utils/logger');

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

    // Store verifier in database (expires in 10 min via TTL index)
    await DLSession.create({ state, code_verifier: codeVerifier, user_id: userId, expires_at: new Date(Date.now() + 10 * 60 * 1000) });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: DL_CLIENT_ID,
      redirect_uri: DL_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'openid',
    });

    const authUrl = `${DL_BASE}/public/oauth2/1/authorize?${params.toString()}`;
    res.json({ success: true, data: { auth_url: authUrl, authUrl, state } });
  } catch (err) { next(err); }
};

/**
 * Step 2: Handle DigiLocker callback — browser redirect from DigiLocker (GET)
 * DigiLocker redirects here with ?code=xxx&state=xxx — no auth token present.
 * We look up the user via the state parameter stored in DLSession.
 */
exports.handleCallback = async (req, res, next) => {
  // Determine where to redirect the user after processing
  const webAppUrl = process.env.WEB_CLIENT_URL || 'https://assure.fund';
  const redirectSuccess = `${webAppUrl}/documents?digilocker=success`;
  const redirectError = (msg) => `${webAppUrl}/documents?digilocker=error&message=${encodeURIComponent(msg)}`;

  try {
    // Log everything DigiLocker sends back for debugging
    logger.info('DigiLocker callback received:', {
      query: req.query,
      method: req.method,
      url: req.originalUrl,
    });

    // DigiLocker may send error on denial or misconfiguration
    if (req.query.error) {
      const errDesc = req.query.error_description || req.query.error;
      logger.error('DigiLocker returned error:', { error: req.query.error, description: errDesc });
      return res.redirect(redirectError(errDesc));
    }

    // DigiLocker sends code & state as query params (GET redirect)
    const code = req.query.code || req.body?.code;
    const state = req.query.state || req.body?.state;
    if (!code || !state) {
      logger.error('DigiLocker callback missing params:', { code: !!code, state: !!state, allQuery: JSON.stringify(req.query) });
      return res.redirect(redirectError('Missing authorization code from DigiLocker'));
    }

    const stored = await DLSession.findOneAndDelete({ state });
    if (!stored) {
      return res.redirect(redirectError('Session expired. Please try again.'));
    }

    const userId = stored.user_id;

    // Exchange code for access token
    const tokenRes = await fetch(`${DL_BASE}/public/oauth2/2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: DL_CLIENT_ID,
        client_secret: DL_CLIENT_SECRET,
        redirect_uri: DL_REDIRECT_URI,
        code_verifier: stored.code_verifier,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      logger.error('DigiLocker token exchange failed:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to authenticate with DigiLocker' });
    }

    const accessToken = tokenData.access_token;
    const digilockerId = tokenData.digilocker_id || tokenData.sub || null;

    // Save DigiLocker ID on user
    await User.findByIdAndUpdate(userId, { digilocker_id: digilockerId });

    // Fetch Aadhaar eKYC data
    let ekyc = null;
    try {
      const ekycRes = await fetch(`${DL_BASE}/public/oauth2/2/xml/eaadhaar`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (ekycRes.ok) {
        ekyc = await ekycRes.text();
      }
    } catch (e) {
      logger.warn('DigiLocker eKYC fetch failed:', e.message);
    }

    // Fetch issued documents list
    let issuedDocs = [];
    try {
      const docsRes = await fetch(`${DL_BASE}/public/oauth2/3/files/issued`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        issuedDocs = docsData.items || docsData.documents || [];
      }
    } catch (e) {
      logger.warn('DigiLocker docs fetch failed:', e.message);
    }

    // Auto-create document records for Aadhaar/PAN if found
    const docTypes = {
      ADHAR: 'aadhaar_card',
      PANCR: 'pan_card',
    };

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
      }
    }

    // Check if all KYC docs are present → auto-verify KYC
    const aadhaarDoc = await Document.findOne({ user_id: userId, document_type: 'aadhaar_card', verification_status: { $in: ['verified', 'approved'] } });
    const panDoc = await Document.findOne({ user_id: userId, document_type: 'pan_card', verification_status: { $in: ['verified', 'approved'] } });

    if (aadhaarDoc && panDoc) {
      await User.findByIdAndUpdate(userId, { kyc_status: 'verified', kyc_verified_at: new Date() });
    }

    // Redirect back to web app with success
    return res.redirect(redirectSuccess);
  } catch (err) {
    logger.error('DigiLocker callback error:', err);
    return res.redirect(redirectError('Something went wrong. Please try again.'));
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
