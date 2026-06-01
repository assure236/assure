const axios = require('axios');
const FormData = require('form-data');
const { User, Document, Notification } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');
const { compareNames } = require('../utils/nameMatch');
const { notifyUser } = require('../utils/notifyUser');
const logger = require('../utils/logger');

const LUXAND_API = 'https://api.luxand.cloud';
const LUXAND_TOKEN = process.env.LUXAND_API_TOKEN;
const LUXAND_TIMEOUT_MS = 15000;
const LUXAND_MAX_RETRIES = 2;

function isLuxandUnavailableResponse(payload) {
  const msg = `${payload?.message || ''} ${payload?.error || ''}`.toLowerCase();
  return (
    msg.includes('trial is ended') ||
    msg.includes('upgrade your plan') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient') ||
    msg.includes('api key') ||
    msg.includes('unauthorized')
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STEPS = ['digilocker', 'face_match', 'bank', 'cheque', 'address'];

function buildStatusPayload(user) {
  const o = user.onboarding || {};
  const digilocker = {
    status: o.digilocker?.status || 'pending',
    connected: !!user.digilocker_id,
    completed_at: o.digilocker?.completed_at || null,
  };
  const manual_kyc = {
    status: o.manual_kyc?.status || 'not_required',
    submitted_at: o.manual_kyc?.submitted_at || null,
    rejection_reason: o.manual_kyc?.rejection_reason || null,
  };
  const face_match = {
    status: o.face_match?.status || 'pending',
    score: o.face_match?.score || null,
    completed_at: o.face_match?.completed_at || null,
  };
  const bank = {
    status: o.bank?.status || 'pending',
    account_holder_name: o.bank?.account_holder_name || null,
    name_match_score: o.bank?.name_match_score || null,
    completed_at: o.bank?.completed_at || null,
    rejection_reason: o.bank?.rejection_reason || null,
  };
  const cheque = {
    status: o.cheque?.status || 'pending',
    completed_at: o.cheque?.completed_at || null,
  };
  const address = {
    status: o.address?.status || 'pending',
    completed_at: o.address?.completed_at || null,
  };

  // Determine next step. Order matters.
  let nextStep = null;
  if (digilocker.status === 'pending') nextStep = 'digilocker';
  else if (face_match.status === 'pending' || face_match.status === 'failed') nextStep = 'face_match';
  else if (bank.status === 'pending' || bank.status === 'rejected') nextStep = 'bank';
  else if (cheque.status === 'pending') nextStep = 'cheque';
  else if (address.status === 'pending') nextStep = 'address';
  else if (!o.completed_at) nextStep = 'complete';

  const completed = !!o.completed_at;

  return {
    completed,
    next_step: nextStep,
    tour_completed: !!o.tour_completed,
    completed_at: o.completed_at || null,
    steps: { digilocker, manual_kyc, face_match, bank, cheque, address },
  };
}

async function uploadDocument({ userId, file, documentType, verificationStatus = 'pending', notes = '' }) {
  // Replace existing of same type
  const existing = await Document.findOne({ user_id: userId, document_type: documentType });
  if (existing) {
    if (existing.gridfs_id) {
      try { await deleteFromGridFS(existing.gridfs_id); } catch (_) {}
    }
    await Document.findByIdAndDelete(existing._id);
  }
  const { fileId, fileUrl } = await uploadToGridFS(file.buffer, file.originalname, file.mimetype, {
    userId: userId.toString(), category: 'kyc', documentType,
  });
  return Document.create({
    user_id: userId,
    document_type: documentType,
    document_name: file.originalname,
    file_name: file.originalname,
    file_url: fileUrl,
    gridfs_id: fileId,
    file_size: file.size || file.buffer?.length || 0,
    mime_type: file.mimetype,
    uploaded_from: 'web',
    verification_status: verificationStatus,
    notes,
  });
}

// ─── GET /onboarding/status ─────────────────────────────────────────────────

exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select(
      'full_name email mobile pan_number aadhaar_number digilocker_id onboarding profile_image_url kyc_status'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Auto-mark digilocker as completed if user has digilocker_id but step still pending
    if (user.digilocker_id && (!user.onboarding?.digilocker || user.onboarding.digilocker.status === 'pending')) {
      user.set('onboarding.digilocker.status', 'completed');
      user.set('onboarding.digilocker.completed_at', new Date());
      await user.save();
    }

    res.json({ success: true, data: buildStatusPayload(user) });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/manual-kyc ────────────────────────────────────────────
// Used when user does NOT have a DigiLocker account. Upload PAN + Aadhaar
// (front/back) for admin review. Marks digilocker step as 'manual'.

exports.submitManualKyc = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const files = req.files || {};
    const panFile = files.pan?.[0];
    const aadhaarFront = files.aadhaar_front?.[0];
    const aadhaarBack = files.aadhaar_back?.[0];

    if (!panFile || !aadhaarFront) {
      return res.status(400).json({ success: false, message: 'PAN and Aadhaar front photos are required.' });
    }

    const panNumber = (req.body.pan_number || '').toUpperCase().trim();
    const aadhaarNumber = (req.body.aadhaar_number || '').replace(/\s/g, '');

    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid PAN number format.' });
    }
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar number. Must be 12 digits.' });
    }

    // Upload docs to GridFS
    await uploadDocument({ userId, file: panFile, documentType: 'pan_card', verificationStatus: 'pending', notes: 'Manual upload — awaiting admin review' });
    await uploadDocument({ userId, file: aadhaarFront, documentType: 'aadhaar_card', verificationStatus: 'pending', notes: 'Manual upload — awaiting admin review' });
    if (aadhaarBack) {
      await uploadDocument({ userId, file: aadhaarBack, documentType: 'aadhaar_card_back', verificationStatus: 'pending', notes: 'Manual upload — awaiting admin review' }).catch(() => {});
    }

    const userUpdate = {
      'onboarding.digilocker.status': 'manual',
      'onboarding.digilocker.completed_at': new Date(),
      'onboarding.manual_kyc.status': 'pending_review',
      'onboarding.manual_kyc.submitted_at': new Date(),
      'onboarding.manual_kyc.rejection_reason': null,
    };
    if (panNumber) userUpdate.pan_number = panNumber;
    if (aadhaarNumber) userUpdate.aadhaar_number = aadhaarNumber;
    await User.findByIdAndUpdate(userId, userUpdate);

    // Notify admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map((a) => ({
          user_id: a._id,
          type: 'onboarding_manual_kyc',
          title: 'Manual KYC Approval Needed',
          message: `${req.user.full_name || 'A member'} uploaded PAN/Aadhaar manually.`,
          metadata: { user_id: String(userId) },
        })));
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'PAN and Aadhaar submitted. Admin will approve within 24 hours. You can continue the remaining onboarding.',
    });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/face-verify ───────────────────────────────────────────
// Capture live selfie, run Luxand liveness, then face-similarity against
// the DigiLocker / KYC photo (Aadhaar photo) stored as a Document.

async function callLuxandLiveness(buffer, mimetype, originalname) {
  let lastErr = null;
  for (let attempt = 1; attempt <= LUXAND_MAX_RETRIES; attempt += 1) {
    try {
      const form = new FormData();
      form.append('photo', buffer, { filename: originalname || 'selfie.jpg', contentType: mimetype || 'image/jpeg' });
      const r = await axios.post(`${LUXAND_API}/photo/liveness`, form, {
        headers: { ...form.getHeaders(), token: LUXAND_TOKEN },
        timeout: LUXAND_TIMEOUT_MS,
        validateStatus: () => true,
      });
      return r.data && typeof r.data === 'object' ? r.data : { status: 'failure' };
    } catch (err) {
      lastErr = err;
      const transient = ['ECONNABORTED', 'ERR_BAD_RESPONSE', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code)
        || /timeout|stream has been aborted|socket hang up|terminated/i.test(err.message || '');
      if (!transient || attempt === LUXAND_MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastErr || new Error('Liveness provider unreachable');
}

// Luxand /photo/verify expects two photos and returns a similarity probability.
async function callLuxandFaceVerify(selfieBuf, selfieName, referenceUrl) {
  // Reference can be a public URL we host (we'll pass via "photo2" file) or remote URL.
  // For DigiLocker photos we don't have a raw image (URI is digilocker://...),
  // so we use the stored selfie or profile image as fallback reference. Caller decides.
  const form = new FormData();
  form.append('photo1', selfieBuf, { filename: selfieName || 'photo1.jpg', contentType: 'image/jpeg' });
  form.append('photo2', referenceUrl);
  const r = await axios.post(`${LUXAND_API}/photo/verify`, form, {
    headers: { ...form.getHeaders(), token: LUXAND_TOKEN },
    timeout: LUXAND_TIMEOUT_MS,
    validateStatus: () => true,
  });
  return r.data && typeof r.data === 'object' ? r.data : { status: 'failure' };
}

exports.verifyFaceMatch = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!req.file) return res.status(400).json({ success: false, message: 'Selfie photo is required.' });

    const user = await User.findById(userId).select('profile_image_url digilocker_id onboarding');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Always store latest selfie for admin review/reference.
    await uploadDocument({
      userId,
      file: req.file,
      documentType: 'selfie_photo',
      verificationStatus: 'pending',
      notes: 'Onboarding face capture',
    }).catch(() => {});

    // 1. Liveness check first (anti-spoof).
    // If provider is unavailable/slow, continue with deferred verification.
    let livenessUnavailable = false;
    if (LUXAND_TOKEN) {
      try {
        const liveness = await callLuxandLiveness(req.file.buffer, req.file.mimetype, req.file.originalname);
        if (isLuxandUnavailableResponse(liveness)) {
          livenessUnavailable = true;
          logger.warn(`Luxand liveness unavailable response, falling back to deferred verification: ${liveness.message || liveness.error || 'unknown'}`);
        } else if (liveness.status === 'failure' || liveness.result !== 'real') {
          await User.updateOne({ _id: userId }, { $inc: { 'onboarding.face_match.attempts': 1 } });
          return res.json({
            success: false,
            live: false,
            message: liveness.message || 'Spoof detected. Please use a real, live face.',
          });
        }
      } catch (e) {
        livenessUnavailable = true;
        logger.warn(`Luxand liveness unavailable, falling back to deferred verification: ${e.code || ''} ${e.message || e}`);
      }
    } else {
      livenessUnavailable = true;
      logger.warn('Luxand token missing: falling back to deferred face verification.');
    }

    // 2. Find reference image. Priority:
    //    a) Existing selfie document (already verified at registration / KYC)
    //    b) profile_image_url (set during previous liveness)
    //    c) If neither, accept this selfie as the reference (cold start), mark deferred.
    const reference = await Document.findOne({ user_id: userId, document_type: 'selfie_photo' }).sort({ created_at: -1 });
    let referenceUrl = null;
    if (reference && reference.file_url && /^https?:\/\//.test(reference.file_url)) {
      referenceUrl = reference.file_url;
    } else if (user.profile_image_url && /^https?:\/\//.test(user.profile_image_url)) {
      referenceUrl = user.profile_image_url;
    }

    let score = null;
    let matched = false;
    let deferred = false;

    if (!livenessUnavailable && referenceUrl) {
      try {
        const verify = await callLuxandFaceVerify(req.file.buffer, req.file.originalname, referenceUrl);
        // Luxand returns { status:'success', same:true/false, score:0..1 }
        score = typeof verify.score === 'number' ? verify.score : null;
        matched = verify.status === 'success' && (verify.same === true || (score !== null && score >= 0.7));
      } catch (e) {
        logger.warn(`Luxand face verify failed: ${e.message}`);
        deferred = true;
      }
    } else {
      // Provider unavailable or cold start — accept capture and continue.
      deferred = true;
    }

    const update = { $inc: { 'onboarding.face_match.attempts': 1 } };
    const set = {};
    if (deferred) {
      set['onboarding.face_match.status'] = 'deferred';
      set['onboarding.face_match.completed_at'] = new Date();
      set['onboarding.face_match.score'] = score;
    } else if (matched) {
      set['onboarding.face_match.status'] = 'verified';
      set['onboarding.face_match.completed_at'] = new Date();
      set['onboarding.face_match.score'] = score;
    } else {
      set['onboarding.face_match.status'] = 'failed';
      set['onboarding.face_match.score'] = score;
    }
    update.$set = set;
    await User.updateOne({ _id: userId }, update);

    if (matched || deferred) {
      return res.json({
        success: true,
        matched: !!matched,
        deferred,
        score,
        message: deferred
          ? 'Face captured. Verification will be confirmed shortly.'
          : 'Face matched successfully.',
      });
    }
    return res.json({
      success: false,
      matched: false,
      score,
      message: 'Face did not match your KYC photo. Please retry in good lighting.',
    });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/bank ──────────────────────────────────────────────────
// Verify bank account via Cashfree (reuses existing userController.verifyBankAccount
// logic internally) and run fuzzy name match against PAN/full_name. Save details
// only if matched; otherwise mark pending_review.

exports.saveBank = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const accountNumber = String(req.body.account_number || '').trim();
    const ifsc = String(req.body.ifsc_code || req.body.ifsc || '').trim().toUpperCase();

    if (!/^\d{9,20}$/.test(accountNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid bank account number.' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC code.' });
    }

    const user = await User.findById(userId).select('full_name pan_number');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Call Cashfree bank verification
    let bankResult = null;
    let bankError = null;
    try {
      const isProd = process.env.CASHFREE_ENV === 'PROD';
      const baseUrl = isProd ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
      const clientId = process.env.CASHFREE_VRS_CLIENT_ID || process.env.CASHFREE_APP_ID;
      const clientSecret = process.env.CASHFREE_VRS_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
      if (!clientId || !clientSecret) {
        bankError = 'Bank verification not configured';
      } else {
        const resp = await axios.post(
          `${baseUrl}/verification/bank-account/sync`,
          { bank_account: accountNumber, ifsc, name: user.full_name || '' },
          {
            headers: { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'Content-Type': 'application/json' },
            timeout: 15000,
            validateStatus: () => true,
          }
        );
        if (resp.status >= 200 && resp.status < 300 && resp.data) {
          const d = resp.data.data || resp.data;
          bankResult = {
            verified: d.account_status === 'VALID' || d.verified === true,
            holderName: (d.name_at_bank || d.account_holder_name || d.registered_name || '').trim(),
            bankName: (d.bank_name || d.bank || '').trim(),
            branch: (d.branch || '').trim(),
          };
        } else {
          bankError = (resp.data && (resp.data.message || resp.data.error)) || `Bank verification failed (status ${resp.status}).`;
        }
      }
    } catch (e) {
      bankError = e.message || 'Bank verification request failed.';
    }

    if (!bankResult || !bankResult.holderName) {
      // Cannot verify automatically — store as pending_review so admin can act.
      await User.updateOne({ _id: userId }, {
        bank_account_number: accountNumber,
        bank_ifsc_code: ifsc,
        'onboarding.bank.status': 'pending_review',
        'onboarding.bank.account_holder_name': null,
        'onboarding.bank.name_match_score': null,
        'onboarding.bank.rejection_reason': bankError || null,
        'onboarding.bank.completed_at': new Date(),
      });
      return res.json({
        success: true,
        pending_review: true,
        message: 'Bank account saved. Admin will verify shortly (within 24 hours).',
      });
    }

    // Fuzzy match holder name against full_name (and PAN-registered name if we had it)
    const compareTo = user.full_name || '';
    const { score, match, reason } = compareNames(bankResult.holderName, compareTo);

    if (!match) {
      await User.updateOne({ _id: userId }, {
        'onboarding.bank.status': 'rejected',
        'onboarding.bank.account_holder_name': bankResult.holderName,
        'onboarding.bank.name_match_score': score,
        'onboarding.bank.rejection_reason': reason,
      });
      return res.status(400).json({
        success: false,
        match: false,
        score,
        account_holder_name: bankResult.holderName,
        message: `Bank account name "${bankResult.holderName}" does not match your registered name "${compareTo}". ${reason}`,
      });
    }

    await User.updateOne({ _id: userId }, {
      bank_account_number: accountNumber,
      bank_ifsc_code: ifsc,
      bank_name: bankResult.bankName || undefined,
      'onboarding.bank.status': 'verified',
      'onboarding.bank.account_holder_name': bankResult.holderName,
      'onboarding.bank.name_match_score': score,
      'onboarding.bank.rejection_reason': null,
      'onboarding.bank.completed_at': new Date(),
    });
    return res.json({
      success: true,
      match: true,
      score,
      account_holder_name: bankResult.holderName,
      bank_name: bankResult.bankName,
      branch: bankResult.branch,
      message: 'Bank account verified.',
    });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/cheque ────────────────────────────────────────────────

exports.saveCheque = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!req.file) return res.status(400).json({ success: false, message: 'Cancelled cheque image is required.' });
    await uploadDocument({
      userId,
      file: req.file,
      documentType: 'cancelled_cheque',
      verificationStatus: 'pending',
      notes: 'Onboarding upload — awaiting admin review',
    });
    await User.updateOne({ _id: userId }, {
      'onboarding.cheque.status': 'uploaded',
      'onboarding.cheque.completed_at': new Date(),
    });
    return res.json({ success: true, message: 'Cancelled cheque uploaded for admin review.' });
  } catch (err) { next(err); }
};

exports.skipCheque = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    await User.updateOne({ _id: userId }, {
      'onboarding.cheque.status': 'skipped',
      'onboarding.cheque.completed_at': new Date(),
    });
    return res.json({ success: true, message: 'Cheque upload skipped. You can add it later from Profile > Documents.' });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/address ───────────────────────────────────────────────

exports.saveAddress = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      address,
      city,
      state,
      pincode,
      current_same_as_permanent,
      current_address,
      current_city,
      current_state,
      current_pincode,
    } = req.body;

    if (!address || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: 'Permanent address is required (address, city, state, pincode).' });
    }
    if (!/^\d{6}$/.test(String(pincode))) {
      return res.status(400).json({ success: false, message: 'Invalid pincode (must be 6 digits).' });
    }

    const sameAsPermanent = current_same_as_permanent === true || current_same_as_permanent === 'true';

    const update = {
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      current_address: sameAsPermanent ? String(address).trim() : String(current_address || '').trim(),
      current_city: sameAsPermanent ? String(city).trim() : String(current_city || '').trim(),
      current_state: sameAsPermanent ? String(state).trim() : String(current_state || '').trim(),
      current_pincode: sameAsPermanent ? String(pincode).trim() : String(current_pincode || '').trim(),
      'onboarding.address.status': 'completed',
      'onboarding.address.completed_at': new Date(),
    };

    if (!sameAsPermanent && update.current_pincode && !/^\d{6}$/.test(update.current_pincode)) {
      return res.status(400).json({ success: false, message: 'Invalid current pincode (must be 6 digits).' });
    }

    await User.updateOne({ _id: userId }, update);
    return res.json({ success: true, message: 'Address saved.' });
  } catch (err) { next(err); }
};

// ─── POST /onboarding/complete ──────────────────────────────────────────────

exports.complete = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Validate required steps are done (cheque & manual-kyc-approval are not blockers)
    const o = user.onboarding || {};
    const digilockerDone = (o.digilocker?.status === 'completed') || (o.digilocker?.status === 'manual');
    const faceDone = ['verified', 'deferred'].includes(o.face_match?.status);
    const bankDone = ['verified', 'pending_review'].includes(o.bank?.status);
    const chequeDone = ['uploaded', 'skipped', 'approved'].includes(o.cheque?.status);
    const addressDone = o.address?.status === 'completed';
    if (!digilockerDone || !faceDone || !bankDone || !chequeDone || !addressDone) {
      return res.status(400).json({ success: false, message: 'Some onboarding steps are still pending.' });
    }

    await User.updateOne({ _id: userId }, {
      'onboarding.completed_at': new Date(),
      kyc_status: user.kyc_status === 'verified' ? 'verified' : 'pending',
    });

    // Notify user — admin approval expected within 24h
    notifyUser(
      String(userId),
      'Onboarding Submitted',
      'Your onboarding has been submitted. Admin approval will be completed within 24 hours.',
      'onboarding_complete',
      {}
    ).catch(() => {});

    // Notify admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map((a) => ({
          user_id: a._id,
          type: 'onboarding_complete',
          title: 'New Onboarding Submission',
          message: `${user.full_name || 'A member'} completed onboarding. Review pending KYC/bank/cheque.`,
          metadata: { user_id: String(userId) },
        })));
      }
    } catch (_) {}

    const fresh = await User.findById(userId).select('onboarding digilocker_id');
    return res.json({ success: true, message: 'Onboarding complete. Awaiting admin approval (~24h).', data: buildStatusPayload(fresh) });
  } catch (err) { next(err); }
};

exports.markTourComplete = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    await User.updateOne({ _id: userId }, { 'onboarding.tour_completed': true });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Admin endpoints ────────────────────────────────────────────────────────

exports.adminListPending = async (req, res, next) => {
  try {
    const filter = {
      $or: [
        { 'onboarding.manual_kyc.status': 'pending_review' },
        { 'onboarding.bank.status': 'pending_review' },
        { 'onboarding.cheque.status': 'uploaded' },
      ],
    };
    const users = await User.find(filter)
      .select('member_id full_name email mobile onboarding profile_image_url created_at')
      .sort({ 'onboarding.completed_at': -1, created_at: -1 })
      .limit(200);
    res.json({ success: true, data: users.map((u) => ({ ...u.toObject(), status: buildStatusPayload(u) })) });
  } catch (err) { next(err); }
};

exports.adminApproveStep = async (req, res, next) => {
  try {
    const { user_id, step } = req.params;
    const { reason } = req.body || {};
    if (!['manual_kyc', 'bank', 'cheque'].includes(step)) {
      return res.status(400).json({ success: false, message: 'Invalid step.' });
    }
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const update = {};
    update[`onboarding.${step}.status`] = step === 'manual_kyc' ? 'approved' : (step === 'bank' ? 'verified' : 'approved');
    update[`onboarding.${step}.reviewed_at`] = new Date();
    update[`onboarding.${step}.rejection_reason`] = null;

    // If manual KYC approved, also mark linked PAN/Aadhaar documents verified.
    if (step === 'manual_kyc') {
      await Document.updateMany(
        { user_id, document_type: { $in: ['pan_card', 'aadhaar_card', 'aadhaar_card_back'] } },
        { verification_status: 'verified', verified_at: new Date(), verified_by: req.user._id || req.user.id }
      );
    }
    if (step === 'cheque') {
      await Document.updateMany(
        { user_id, document_type: 'cancelled_cheque' },
        { verification_status: 'verified', verified_at: new Date(), verified_by: req.user._id || req.user.id }
      );
    }

    await User.updateOne({ _id: user_id }, update);

    notifyUser(String(user_id), 'Onboarding Step Approved', `Your ${step.replace('_', ' ')} has been approved by admin.`, 'onboarding_step_approved', { step, reason }).catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.adminRejectStep = async (req, res, next) => {
  try {
    const { user_id, step } = req.params;
    const { reason } = req.body || {};
    if (!['manual_kyc', 'bank', 'cheque'].includes(step)) {
      return res.status(400).json({ success: false, message: 'Invalid step.' });
    }
    const update = {};
    update[`onboarding.${step}.status`] = 'rejected';
    update[`onboarding.${step}.reviewed_at`] = new Date();
    update[`onboarding.${step}.rejection_reason`] = reason || 'Rejected by admin';
    await User.updateOne({ _id: user_id }, update);
    notifyUser(String(user_id), 'Onboarding Step Rejected', `Your ${step.replace('_', ' ')} was rejected. Reason: ${reason || 'See app for details.'}`, 'onboarding_step_rejected', { step, reason }).catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
};
