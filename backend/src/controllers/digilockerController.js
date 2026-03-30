const crypto = require('crypto');
const { User, Document } = require('../models');
const logger = require('../utils/logger');

// DigiLocker OAuth2 config — set these in .env
const DL_BASE = process.env.DIGILOCKER_BASE_URL || 'https://api.digitallocker.gov.in';
const DL_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || '';
const DL_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';
const DL_REDIRECT_URI = process.env.DIGILOCKER_REDIRECT_URI || '';

// In-memory code_verifier store (use Redis in production)
const verifierStore = new Map();

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
      return res.status(503).json({ success: false, message: 'DigiLocker integration not configured yet. Please contact admin.' });
    }

    const userId = String(req.user._id || req.user.id);
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store verifier keyed by state (expires in 10 min)
    verifierStore.set(state, { codeVerifier, userId });
    setTimeout(() => verifierStore.delete(state), 10 * 60 * 1000);

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
    res.json({ success: true, data: { authUrl, state } });
  } catch (err) { next(err); }
};

/**
 * Step 2: Handle DigiLocker callback — exchange code for token & fetch docs
 */
exports.handleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'code and state are required' });
    }

    const stored = verifierStore.get(state);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'Invalid or expired state' });
    }
    verifierStore.delete(state);

    const userId = stored.userId;

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
        code_verifier: stored.codeVerifier,
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

    res.json({
      success: true,
      message: 'DigiLocker connected successfully',
      data: {
        digilocker_id: digilockerId,
        documents_imported: issuedDocs.length,
        kyc_auto_verified: !!(aadhaarDoc && panDoc),
      }
    });
  } catch (err) { next(err); }
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
