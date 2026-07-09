const { User, ChitGroup, ChitMember, Payment, Auction } = require('../models');
const AgentRequest = require('../models/AgentRequest');
const bcrypt = require('bcrypt');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { uploadToGridFS } = require('../utils/gridfs');
const { notifyUser } = require('../utils/notifyUser');
const { sendEmail, sendOTP } = require('../services/notificationService');
const { audit, getIp } = require('../utils/audit');
const { syncChitGroupStatuses } = require('../utils/chitGroupStatusSync');
const { toMemberProfileUser } = require('../utils/userResponse');

const bankVerifyAttempts = new Map();
const BANK_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const BANK_VERIFY_MAX_ATTEMPTS = 8;

const isBankVerifyRateLimited = (userId) => {
  const key = String(userId || 'anonymous');
  const now = Date.now();
  const cutoff = now - BANK_VERIFY_WINDOW_MS;
  const attempts = (bankVerifyAttempts.get(key) || []).filter((t) => t > cutoff);
  if (attempts.length >= BANK_VERIFY_MAX_ATTEMPTS) {
    bankVerifyAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  bankVerifyAttempts.set(key, attempts);
  return false;
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password_hash');
    const userObj = user.toObject();

    // Show submitted values while waiting for admin approval.
    if (userObj.profile_edit_status === 'pending' && userObj.pending_profile_changes) {
      const previewFields = [
        'address',
        'date_of_birth',
        'city',
        'state',
        'pincode',
        'pan_number',
        'bank_account_number',
        'bank_ifsc_code',
        'bank_name',
        'gender',
        'nominee_name',
        'nominee_relationship',
        'current_address',
        'current_city',
        'current_state',
        'current_pincode',
      ];

      for (const field of previewFields) {
        if (userObj.pending_profile_changes[field] !== undefined) {
          userObj[field] = userObj.pending_profile_changes[field];
        }
      }
    }

    userObj.id = userObj._id;
    delete userObj.pending_profile_changes;
    res.json({ success: true, data: toMemberProfileUser(userObj) });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId).select('profile_edit_status full_name digilocker_id date_of_birth gender');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Nominee updates are allowed with OTP even when profile is already approved.
    const hasNomineeName = req.body.nominee_name !== undefined;
    const hasNomineeRelationship = req.body.nominee_relationship !== undefined;
    const hasOnlyNomineeFields = Object.keys(req.body || {}).every((k) =>
      ['nominee_name', 'nominee_relationship', 'otp'].includes(k)
    );
    if (hasOnlyNomineeFields && (hasNomineeName || hasNomineeRelationship)) {
      if (!_checkOtp('nominee:' + userId, req.body.otp)) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
      }
      const directUpdates = {};
      if (hasNomineeRelationship) {
        const relation = String(req.body.nominee_relationship || '').trim();
        if (!relation) return res.status(400).json({ success: false, message: 'Select relationship' });
        directUpdates.nominee_relationship = relation;
      }
      if (hasNomineeName) {
        const nomineeName = String(req.body.nominee_name || '').trim();
        if (nomineeName.length < 2) {
          return res.status(400).json({ success: false, message: 'Enter nominee name' });
        }
        directUpdates.nominee_name = nomineeName;
      }

      const user = await User.findByIdAndUpdate(userId, directUpdates, { new: true }).select('-password_hash');
      const userObj = toMemberProfileUser(user.toObject());
      userObj.id = userObj._id;
      return res.json({ success: true, message: 'Nominee updated successfully.', data: userObj });
    }

    const status = currentUser.profile_edit_status || 'none';
    if (['pending', 'approved'].includes(status)) {
      return res.status(403).json({
        success: false,
        message: status === 'pending'
          ? 'Your profile submission is already pending admin approval.'
          : 'Profile already approved. Contact support for further changes.',
      });
    }

    const allowedFields = [
      'address',
      'date_of_birth',
      'city',
      'state',
      'pincode',
      'pan_number',
      'bank_account_number',
      'bank_ifsc_code',
      'bank_name',
      'gender',
      'nominee_name',
      'nominee_relationship',
      'current_address',
      'current_city',
      'current_state',
      'current_pincode',
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No profile changes provided.' });
    }

    if (updates.pan_number) updates.pan_number = updates.pan_number.toUpperCase();
    if (updates.bank_ifsc_code) updates.bank_ifsc_code = updates.bank_ifsc_code.toUpperCase();

    if (updates.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(updates.pan_number)) {
      return res.status(400).json({ success: false, message: 'Invalid PAN format.' });
    }

    if (updates.bank_account_number && !/^\d{9,18}$/.test(String(updates.bank_account_number))) {
      return res.status(400).json({ success: false, message: 'Invalid bank account number format.' });
    }

    if (updates.bank_ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(updates.bank_ifsc_code)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format.' });
    }

    // Keep DOB and gender aligned with DigiLocker/PAN verified identity.
    if (currentUser.digilocker_id) {
      const normalizeDate = (value) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toISOString().split('T')[0];
        }
        const text = String(value).trim();
        if (!text) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const parsed = new Date(text);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
      };

      const verifiedDob = normalizeDate(currentUser.date_of_birth);
      const requestedDob = normalizeDate(updates.date_of_birth);
      if (verifiedDob && requestedDob && verifiedDob !== requestedDob) {
        return res.status(400).json({
          success: false,
          message: 'Date of birth must match your DigiLocker/PAN verified details.',
        });
      }

      const verifiedGender = (currentUser.gender || '').toString().trim().toLowerCase();
      const requestedGender = (updates.gender || '').toString().trim().toLowerCase();
      if (verifiedGender && requestedGender && verifiedGender !== requestedGender) {
        return res.status(400).json({
          success: false,
          message: 'Gender must match your DigiLocker/PAN verified details.',
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        profile_edit_status: 'pending',
        pending_profile_changes: updates,
        profile_edit_requested_at: new Date(),
        profile_edit_rejection_reason: null,
        profile_edit_rejection_fields: [],
      },
      { new: true }
    ).select('-password_hash');

    const userObj = user.toObject();
    for (const [field, value] of Object.entries(updates)) {
      userObj[field] = value;
    }
    userObj.id = userObj._id;
    delete userObj.pending_profile_changes;

    const { Notification } = require('../models');
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((admin) => ({
          user_id: admin._id,
          type: 'profile_edit_request',
          title: 'Profile Approval Needed',
          message: `${currentUser.full_name || 'Member'} submitted profile details for approval.`,
          metadata: { request_user_id: userId, changes: updates },
        }))
      );
    }

    notifyUser(
      String(userId),
      'Profile Submitted Successfully',
      'Your application is submitted and will be reviewed within 24 hours. You will receive an app notification after admin verification.',
      'profile_edit_request',
      { pending_approval: true }
    ).catch(() => {});

    const submitter = await User.findById(userId).select('email full_name');
    if (submitter?.email) {
      const safeName = (submitter.full_name || 'Member').toString();
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Profile Submitted</h2>
          <p>Hi ${safeName},</p>
          <p>Your profile and KYC application has been submitted successfully.</p>
          <p><strong>Review timeline:</strong> within 24 hours.</p>
          <p>You will receive an app notification once admin verification is completed.</p>
          <p>Thank you,<br/>Assure ChitFunds Team</p>
        </div>
      `;
      sendEmail(submitter.email, 'Profile Submitted - Review in 24 Hours', emailHtml).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Profile submitted successfully. Your application will be verified within 24 hours. You will receive app/email notification after admin review.',
      pending_approval: true,
      data: toMemberProfileUser(userObj),
    });

    audit({
      userId, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_requested',
      resourceType: 'user', resourceId: String(userId),
      description: 'Profile edit submitted for approval',
      metadata: { fields_updated: Object.keys(updates) },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

// Admin: Approve profile edit
exports.approveProfileEdit = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.profile_edit_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending edit request' });
    }

    const changes = { ...(targetUser.pending_profile_changes || {}) };
    if (changes.address_change_status === 'pending_review') {
      changes.address_change_status = 'approved';
    }
    if (changes.bank_change_status === 'pending_review') {
      changes.bank_change_status = 'approved';
    }
    if (changes.bank_change_status === 'verified') {
      changes.bank_verified = true;
      changes.bank_verified_at = new Date();
    }

    await User.findByIdAndUpdate(user_id, {
      ...changes,
      profile_edit_status: 'approved',
      pending_profile_changes: null,
      profile_edit_reviewed_at: new Date(),
      profile_edit_reviewed_by: req.user._id || req.user.id,
      profile_edit_rejection_reason: null,
      profile_edit_rejection_fields: [],
    });

    // Notify user
    const { Notification } = require('../models');
    await Notification.create({
      user_id,
      type: 'profile_edit_approved',
      title: 'Profile Changes Approved',
      message: 'Your profile changes have been approved and applied.',
    });

    const user = await User.findById(user_id).select('-password_hash');
    res.json({ success: true, message: 'Profile edit approved', data: user });

    audit({
      userId: req.user._id || req.user.id, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_approved', resourceType: 'user', resourceId: String(user_id),
      description: `Approved profile edit for ${targetUser.full_name}`,
      metadata: { approved_fields: Object.keys(changes) },
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

// Admin: Reject profile edit
exports.rejectProfileEdit = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { reason, rejection_fields } = req.body;
    const targetUser = await User.findById(user_id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.profile_edit_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending edit request' });
    }

    const allowedRejectionFields = [
      'pan_number',
      'bank_account_number',
      'bank_ifsc_code',
      'bank_name',
      'address',
      'city',
      'state',
      'pincode',
      'date_of_birth',
      'gender',
      'nominee_name',
      'nominee_relationship',
      'current_address',
      'current_city',
      'current_state',
      'current_pincode',
    ];

    const rejectionFields = Array.isArray(rejection_fields)
      ? rejection_fields.filter((field) => allowedRejectionFields.includes(field))
      : [];

    const pendingChanges = targetUser.pending_profile_changes || {};
    const extraStatusUpdates = {};
    if (pendingChanges.address_change_status === 'pending_review') {
      extraStatusUpdates.address_change_status = 'rejected';
    }
    if (pendingChanges.bank_change_status === 'pending_review') {
      extraStatusUpdates.bank_change_status = 'rejected';
    }

    await User.findByIdAndUpdate(user_id, {
      profile_edit_status: 'rejected',
      pending_profile_changes: null,
      profile_edit_reviewed_at: new Date(),
      profile_edit_reviewed_by: req.user._id || req.user.id,
      profile_edit_rejection_reason: reason || 'Rejected by admin',
      profile_edit_rejection_fields: rejectionFields,
      ...extraStatusUpdates,
    });

    // Notify user
    const { Notification } = require('../models');
    await Notification.create({
      user_id,
      type: 'profile_edit_rejected',
      title: 'Profile Changes Rejected',
      message: `Your profile changes were rejected. Reason: ${reason || 'See admin.'}`,
      metadata: { rejection_fields: rejectionFields },
    });

    res.json({ success: true, message: 'Profile edit rejected' });

    audit({
      userId: req.user._id || req.user.id, userName: req.user.full_name, userRole: req.user.role,
      action: 'profile_edit_rejected', resourceType: 'user', resourceId: String(user_id),
      description: `Rejected profile edit for ${targetUser.full_name}: ${reason || 'No reason'}`,
      ipAddress: getIp(req),
    });
  } catch (err) { next(err); }
};

exports.lookupIfsc = async (req, res, next) => {
  try {
    const ifsc = String(req.params.ifsc || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format.' });
    }

    const response = await axios.get(`https://ifsc.razorpay.com/${ifsc}`, {
      timeout: 8000,
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data) {
      return res.status(404).json({ success: false, message: 'IFSC details not found.' });
    }

    const data = response.data;
    return res.json({
      success: true,
      data: {
        ifsc,
        bank: data.BANK || '',
        branch: data.BRANCH || '',
        address: data.ADDRESS || '',
        city: data.CITY || '',
        district: data.DISTRICT || '',
        state: data.STATE || '',
      },
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Unable to verify IFSC right now. Please try again.',
    });
  }
};

exports.verifyBankAccount = async (req, res, next) => {
  try {
    const accountNumber = String(req.body.account_number || req.body.bank_account_number || '').trim();
    const ifsc = String(req.body.ifsc || req.body.bank_ifsc_code || '').trim().toUpperCase();
    const holderName = String(req.body.name || req.body.account_holder_name || '').trim();
    const holderPhone = String(req.body.phone || '').trim();
    const requesterId = req.user && (req.user._id || req.user.id);

    if (!/^\d{9,20}$/.test(accountNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid bank account number format.' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format.' });
    }

    if (isBankVerifyRateLimited(requesterId)) {
      return res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please wait a few minutes and try again.',
      });
    }

    const credentialPairsRaw = [
      {
        source: 'bank_verification',
        id: process.env.BANK_ACCOUNT_VERIFICATION_CLIENT_ID || '',
        secret: process.env.BANK_ACCOUNT_VERIFICATION_CLIENT_SECRET || '',
      },
      {
        source: 'cashfree_vrs',
        id: process.env.CASHFREE_VRS_CLIENT_ID || '',
        secret: process.env.CASHFREE_VRS_CLIENT_SECRET || '',
      },
      {
        source: 'cashfree_payment',
        id: process.env.CASHFREE_APP_ID || '',
        secret: process.env.CASHFREE_SECRET_KEY || '',
      },
      {
        source: 'cashfree_payment_alt',
        id: process.env.CASHFREE_APP_ID || '',
        secret: process.env.BANK_ACCOUNT_VERIFICATION_API_KEY || process.env.PAN_VERIFICATION_API_KEY || '',
      },
    ];

    const credentialPairs = [];
    const credentialSeen = new Set();
    for (const pair of credentialPairsRaw) {
      const id = String(pair.id || '').trim();
      const secret = String(pair.secret || '').trim();
      if (!id || !secret) {
        continue;
      }

      const dedupeKey = `${id}::${secret}`;
      if (credentialSeen.has(dedupeKey)) {
        continue;
      }

      credentialSeen.add(dedupeKey);
      credentialPairs.push({ source: pair.source, id, secret });
    }

    if (!credentialPairs.length) {
      return res.status(503).json({
        success: false,
        message: 'Bank account verification is not configured right now.',
      });
    }

    const isProd = process.env.CASHFREE_ENV === 'PROD';
    const baseUrl = isProd
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com';
    const payoutAuthFallbackBase = isProd
      ? 'https://payout-api.cashfree.com'
      : 'https://payout-gamma.cashfree.com';
    const signaturePublicKeyInline = String(process.env.CASHFREE_VRS_PUBLIC_KEY || '').trim();
    const signaturePublicKeyPath = String(process.env.CASHFREE_VRS_PUBLIC_KEY_PATH || '').trim();

    const optionalIdentity = {
      ...(holderName ? { name: holderName } : {}),
      ...(holderPhone ? { phone: holderPhone } : {}),
    };

    // VRS v2 sync expects bank_account + ifsc. Keep compatibility fallbacks as secondary.
    const payloadVariants = [
      { bank_account: accountNumber, ifsc, ...optionalIdentity },
      { bank_account_number: accountNumber, ifsc, ...optionalIdentity },
      { account_number: accountNumber, ifsc, ...optionalIdentity },
    ];

    const unique = (items) => [...new Set(items.filter(Boolean))];

    const parseVerificationData = (body, statusCode) => {
      const root = body && typeof body === 'object' ? body : {};
      const data = root.data && typeof root.data === 'object'
        ? root.data
        : root.result && typeof root.result === 'object'
          ? root.result
          : root;

      const ifscDetails = data.ifsc_details && typeof data.ifsc_details === 'object'
        ? data.ifsc_details
        : {};

      const accountHolderName =
        (data.account_holder_name || data.name_at_bank || data.account_name || data.beneficiary_name || data.registered_name || data.name || '').toString().trim() ||
        null;

      const bankName =
        (data.bank_name || data.bank || data.bankName || ifscDetails.bank_name || '').toString().trim() ||
        null;

      const branch =
        (data.branch || data.branch_name || data.branchName || ifscDetails.branch || '').toString().trim() ||
        null;

      const accountStatus = (data.account_status || data.status || root.status || '').toString().trim().toUpperCase();
      const verified =
        data.verified === true ||
        data.valid === true ||
        accountStatus === 'VALID' ||
        accountStatus === 'VERIFIED' ||
        accountStatus === 'SUCCESS' ||
        (!!accountHolderName && statusCode >= 200 && statusCode < 300);

      return {
        verified,
        accountHolderName,
        bankName,
        branch,
      };
    };

    const toErrorMessage = (body, statusCode) => {
      const root = body && typeof body === 'object' ? body : {};
      return (
        root.message ||
        root.error ||
        root.type ||
        `Bank account verification failed (status ${statusCode}).`
      );
    };

    const toErrorDetails = (body, statusCode, endpoint) => {
      const root = body && typeof body === 'object' ? body : {};
      const code = String(root.code || root.error_code || '').trim().toLowerCase();
      const message = toErrorMessage(root, statusCode);
      return {
        statusCode,
        code,
        message: String(message || '').trim(),
        endpoint: endpoint || null,
      };
    };

    const readSignaturePublicKey = () => {
      if (signaturePublicKeyInline) {
        return signaturePublicKeyInline;
      }

      if (!signaturePublicKeyPath) {
        return null;
      }

      try {
        return fs.readFileSync(signaturePublicKeyPath, 'utf8');
      } catch (err) {
        return null;
      }
    };

    const buildCfSignature = (activeClientId) => {
      const publicKey = readSignaturePublicKey();
      if (!publicKey) {
        return null;
      }

      try {
        const unixNow = Math.floor(Date.now() / 1000);
        const payload = `${activeClientId}.${unixNow}`;
        const encrypted = crypto.publicEncrypt(
          {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha1',
          },
          Buffer.from(payload, 'utf8')
        );

        return encrypted.toString('base64');
      } catch (err) {
        return null;
      }
    };

    const toSuccessResponse = (parsed, provider) => res.json({
      success: true,
      data: {
        verified: parsed.verified,
        account_holder_name: parsed.accountHolderName,
        bank_name: parsed.bankName,
        branch: parsed.branch,
        ifsc,
        account_number_masked: `XXXXXX${accountNumber.slice(-4)}`,
        provider,
      },
    });

    let lastErrorMessage = null;
    const providerErrors = [];

    const captureProviderError = (errorDetails) => {
      if (errorDetails && (errorDetails.code || errorDetails.message)) {
        providerErrors.push(errorDetails);
        lastErrorMessage = errorDetails.message;
      }
    };

    for (const credentials of credentialPairs) {
      const activeClientId = credentials.id;
      const activeClientSecret = credentials.secret;

      const directEndpoints = unique([
        process.env.BANK_ACCOUNT_VERIFICATION_URL,
        `${baseUrl}/verification/bank-account/sync`,
        `${baseUrl}/verification/bank-account`,
      ]);

      const directHeaderVariants = [
        {
          'x-client-id': activeClientId,
          'x-client-secret': activeClientSecret,
          'Content-Type': 'application/json',
        },
        {
          'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
          'x-client-id': activeClientId,
          'x-client-secret': activeClientSecret,
          'Content-Type': 'application/json',
        },
      ];

      for (const endpoint of directEndpoints) {
        for (const payload of payloadVariants) {
          for (const headers of directHeaderVariants) {
            const signature = buildCfSignature(activeClientId);
            const requestHeaders = signature
              ? { ...headers, 'x-cf-signature': signature }
              : headers;

            try {
              const response = await axios.post(endpoint, payload, {
                headers: requestHeaders,
                timeout: 12000,
                validateStatus: () => true,
              });

              const body = response.data && typeof response.data === 'object'
                ? response.data
                : {};

              if (response.status >= 200 && response.status < 300) {
                const parsed = parseVerificationData(body, response.status);
                const hasData = !!(parsed.accountHolderName || parsed.bankName || parsed.branch);

                if (parsed.verified || hasData) {
                  return toSuccessResponse(parsed, 'cashfree');
                }
              }

              captureProviderError(toErrorDetails(body, response.status, `${credentials.source}:${endpoint}`));
            } catch (err) {
              captureProviderError({
                statusCode: null,
                code: '',
                message: err.message || 'Bank account verification failed.',
                endpoint: `${credentials.source}:${endpoint}`,
              });
            }
          }
        }
      }

      const payoutAuthEndpoints = unique([
        process.env.CASHFREE_PAYOUT_AUTH_URL,
        `${baseUrl}/payout/v1/authorize`,
        `${payoutAuthFallbackBase}/payout/v1/authorize`,
      ]);

      let payoutToken = null;
      for (const authEndpoint of payoutAuthEndpoints) {
        try {
          const authResponse = await axios.post(authEndpoint, {}, {
            headers: {
              'x-client-id': activeClientId,
              'x-client-secret': activeClientSecret,
              'Content-Type': 'application/json',
            },
            timeout: 12000,
            validateStatus: () => true,
          });

          const authBody = authResponse.data && typeof authResponse.data === 'object'
            ? authResponse.data
            : {};

          payoutToken =
            (authBody.data && authBody.data.token) ||
            authBody.token ||
            null;

          if (payoutToken) {
            break;
          }

          captureProviderError(toErrorDetails(authBody, authResponse.status, `${credentials.source}:${authEndpoint}`));
        } catch (err) {
          captureProviderError({
            statusCode: null,
            code: '',
            message: err.message || 'Unable to authorize payout verification.',
            endpoint: `${credentials.source}:${authEndpoint}`,
          });
        }
      }

      if (payoutToken) {
        const payoutVerificationEndpoints = unique([
          process.env.BANK_ACCOUNT_VERIFICATION_PAYOUT_URL,
          `${baseUrl}/payout/verification/bank-account`,
          `${baseUrl}/payout/verification/bank-account/sync`,
        ]);

        for (const endpoint of payoutVerificationEndpoints) {
          for (const payload of payloadVariants) {
            try {
              const response = await axios.post(endpoint, payload, {
                headers: {
                  Authorization: `Bearer ${payoutToken}`,
                  'Content-Type': 'application/json',
                },
                timeout: 12000,
                validateStatus: () => true,
              });

              const body = response.data && typeof response.data === 'object'
                ? response.data
                : {};

              if (response.status >= 200 && response.status < 300) {
                const parsed = parseVerificationData(body, response.status);
                const hasData = !!(parsed.accountHolderName || parsed.bankName || parsed.branch);

                if (parsed.verified || hasData) {
                  return toSuccessResponse(parsed, 'cashfree_payout');
                }
              }

              captureProviderError(toErrorDetails(body, response.status, `${credentials.source}:${endpoint}`));
            } catch (err) {
              captureProviderError({
                statusCode: null,
                code: '',
                message: err.message || 'Bank account verification failed.',
                endpoint: `${credentials.source}:${endpoint}`,
              });
            }
          }
        }
      }
    }

    const rawError = String(lastErrorMessage || '').trim();
    const normalizedError = rawError.toLowerCase();
    const hasProviderError = (matcher) =>
      providerErrors.some((entry) => matcher(entry, `${entry.code} ${entry.message}`.toLowerCase()));

    const isServiceNotEnabled = hasProviderError((entry, combined) =>
      combined.includes('service not enabled') ||
      (entry.code === 'invalid_request' && combined.includes('enabled'))
    );

    const isIpNotWhitelisted = hasProviderError((_, combined) =>
      combined.includes('ip_validation_failed') || combined.includes('ip not whitelisted')
    );

    const isSignatureMissing = hasProviderError((_, combined) =>
      combined.includes('x-cf-signature missing')
    );

    const isCredentialInvalid = hasProviderError((_, combined) =>
      combined.includes('x-client-secret_value_invalid') ||
      combined.includes('invalid clientid and clientsecret combination')
    );

    const isProviderRateLimited = hasProviderError((_, combined) =>
      combined.includes('too_many_requests_per_operation') ||
      combined.includes('too_many_requests_per_ip')
    );

    const isInsufficientBalance = hasProviderError((_, combined) =>
      combined.includes('insufficient_balance')
    );

    const isProviderInfraIssue =
      normalizedError.includes('token is not valid') ||
      normalizedError.includes('something went wrong') ||
      normalizedError.includes('internal server error') ||
      normalizedError.includes('api_error') ||
      normalizedError.includes('endpoint or method is not valid') ||
      normalizedError.includes('route not found');

    if (isProviderRateLimited) {
      return res.status(429).json({
        success: false,
        message: 'Bank verification is temporarily rate-limited by provider. Please try again shortly.',
      });
    }

    if (isServiceNotEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Bank verification is not enabled on the configured Cashfree account. Please contact Cashfree support to enable Secure ID BAV v2 for production.',
      });
    }

    if (isIpNotWhitelisted) {
      return res.status(503).json({
        success: false,
        message: 'Cashfree rejected this request due to IP whitelist settings. Please whitelist this server IP in Secure ID 2FA settings.',
      });
    }

    if (isSignatureMissing) {
      return res.status(503).json({
        success: false,
        message: 'Cashfree Secure ID requires x-cf-signature in Public Key mode. Configure CASHFREE_VRS_PUBLIC_KEY or switch 2FA method to IP Whitelist.',
      });
    }

    if (isCredentialInvalid) {
      return res.status(503).json({
        success: false,
        message: 'Cashfree verification credentials are invalid for this environment. Please check VRS client ID and client secret.',
      });
    }

    if (isInsufficientBalance) {
      return res.status(503).json({
        success: false,
        message: 'Cashfree verification balance is insufficient. Please recharge Secure ID wallet and try again.',
      });
    }

    const publicErrorMessage = isProviderInfraIssue
      ? 'Live bank verification service is temporarily unavailable. Please try again later.'
      : rawError || 'Live bank verification service is temporarily unavailable. Please try again later.';

    return res.status(502).json({
      success: false,
      message: publicErrorMessage,
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Live bank verification service is temporarily unavailable. Please try again later.',
    });
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const currentPassword = req.body.currentPassword || req.body.current_password;
    const newPassword = req.body.newPassword || req.body.new_password;
    const user = await User.findById(req.user._id || req.user.id);
    const valid = await user.validatePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password_hash = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const userId = req.user._id || req.user.id;

    const { fileUrl } = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype, {
      userId: userId.toString(), category: 'profiles',
    });

    const user = await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl }, { new: true }).select('-password_hash');
    const userObj = user.toObject();
    userObj.id = userObj._id;
    res.json({ success: true, message: 'Profile image uploaded', data: userObj });
  } catch (err) { next(err); }
};

exports.getMyChitGroups = async (req, res, next) => {
  try {
    await syncChitGroupStatuses();

    const memberships = await ChitMember.find({ user_id: req.user._id || req.user.id })
      .sort({ enrollment_date: -1, created_at: -1 })
      .populate('chit_group_id');

    // Compute current_month from completed auction count for accurate months tracking
    const enriched = await Promise.all(memberships.map(async (m) => {
      const obj = m.toObject();
      if (obj.chit_group_id && obj.chit_group_id._id) {
        const completedCount = await Auction.countDocuments({
          chit_group_id: obj.chit_group_id._id,
          status: 'completed',
        });
        obj.chit_group_id.current_month = completedCount;
      }
      return obj;
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

exports.getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user_id: req.user._id || req.user.id })
      .sort({ created_at: -1 });
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
};

exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcm_token } = req.body;
    await User.findByIdAndUpdate(req.user._id || req.user.id, { fcm_token });
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) { next(err); }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, kyc_status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (kyc_status) filter.kyc_status = kyc_status;
    const total = await User.countDocuments(filter);
    const rows = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ── Agent Request ──
exports.submitAgentRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const existing = await AgentRequest.findOne({ user_id: userId, status: 'pending' });
    if (existing) return res.status(400).json({ success: false, message: 'You already have a pending agent request' });
    const user = await User.findById(userId);
    if (user.role === 'agent') return res.status(400).json({ success: false, message: 'You are already an agent' });
    const request = await AgentRequest.create({ user_id: userId });
    res.json({ success: true, data: request, message: 'Agent request submitted successfully' });
  } catch (err) { next(err); }
};

exports.getMyAgentRequest = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const request = await AgentRequest.findOne({ user_id: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

// ── Admin: Agent Requests ──
exports.getAgentRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const total = await AgentRequest.countDocuments(filter);
    const rows = await AgentRequest.find(filter)
      .populate('user_id', 'full_name phone email member_id profile_image_url')
      .populate('reviewed_by', 'full_name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.reviewAgentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }
    const request = await AgentRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already reviewed' });
    request.status = status;
    request.admin_note = admin_note;
    request.reviewed_by = req.user._id || req.user.id;
    request.reviewed_at = new Date();
    await request.save();
    if (status === 'approved') {
      await User.findByIdAndUpdate(request.user_id, { role: 'agent' });
    }
    res.json({ success: true, data: request, message: `Agent request ${status}` });
  } catch (err) { next(err); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { full_name, email, mobile, role, is_active, kyc_status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { full_name, email, mobile, role, is_active, kyc_status },
      { new: true }
    ).select('-password_hash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User updated', data: user });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
};

// ─── PROFILE CHANGE ENDPOINTS ───────────────────────────────────────────────
const _otpStore = new Map();
const _otpTtl = 10*60*1000;
function _storeOtp(k,v){_otpStore.set(k,{otp:String(v),exp:Date.now()+_otpTtl})}
function _checkOtp(k,v){const e=_otpStore.get(k);if(!e||Date.now()>e.exp){_otpStore.delete(k);return false;}if(e.otp!==String(v).trim())return false;_otpStore.delete(k);return true;}


exports.changeEmailSendOtp = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const email = (req.body.email || '').trim().toLowerCase();
    if (!/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(email))
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered with another account.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    _storeOtp('email:' + userId, otp);
    const emailResult = await sendEmail(
      email,
      'Assure ChitFunds Email Change OTP',
      `<p>Your OTP is: <b>${otp}</b></p><p>Valid for 10 minutes.</p>`
    );
    if (!emailResult) {
      return res.status(503).json({ success: false, message: 'Email OTP service is unavailable. Please try again shortly.' });
    }
    res.json({ success: true, message: 'OTP sent to ' + email });
  } catch (err) { next(err); }
};

exports.changeEmailVerifyOtp = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!_checkOtp('email:' + userId, req.body.otp))
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    const email = (req.body.email || '').trim().toLowerCase();
    await User.findByIdAndUpdate(userId, { email });
    res.json({ success: true, message: 'Email updated successfully.' });
  } catch (err) { next(err); }
};

exports.nomineeOtpSend = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('mobile');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    _storeOtp('nominee:' + userId, otp);
    await sendOTP(user.mobile, otp);
    res.json({ success: true, message: 'OTP sent to your registered mobile.' });
  } catch (err) { next(err); }
};

exports.changeAddress = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId).select('full_name profile_edit_status pending_profile_changes');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    if ((currentUser.profile_edit_status || 'none') === 'pending') {
      return res.status(403).json({ success: false, message: 'You already have a pending profile review. Please wait for admin approval or rejection.' });
    }

    const { address, city, state, pincode, current_address, current_city, current_state, current_pincode } = req.body;
    if (!address || !city || !state || !/^\d{6}$/.test(String(pincode || '')))
      return res.status(400).json({ success: false, message: 'Fill all address fields correctly (6-digit pincode).' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Address proof document is required.' });
    const { fileUrl } = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype, { userId: String(userId), category: 'address_proof' });
    const pendingUpdates = {
      ...(currentUser.pending_profile_changes || {}),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: String(pincode).trim(),
      address_proof_url: fileUrl,
      address_change_status: 'pending_review',
    };
    if (current_address) {
      pendingUpdates.current_address = current_address.trim();
      pendingUpdates.current_city = (current_city || '').trim();
      pendingUpdates.current_state = (current_state || '').trim();
      pendingUpdates.current_pincode = (current_pincode || '').trim();
    }

    await User.findByIdAndUpdate(userId, {
      profile_edit_status: 'pending',
      pending_profile_changes: pendingUpdates,
      profile_edit_requested_at: new Date(),
      profile_edit_rejection_reason: null,
      profile_edit_rejection_fields: [],
    });

    try {
      const { Notification } = require('../models');
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map(a => ({
          user_id: a._id,
          type: 'profile_edit_request',
          title: 'Address Change Review Needed',
          message: (currentUser.full_name || req.user.full_name || 'A member') + ' submitted address change for approval.',
          data: { request_user_id: String(userId), changes: pendingUpdates },
        })));
      }
    } catch (_) {}
    res.json({ success: true, message: 'Address submitted. Admin will verify within 24 hours.' });
  } catch (err) { next(err); }
};

exports.changeBankDetails = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId).select('full_name profile_edit_status pending_profile_changes');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    if ((currentUser.profile_edit_status || 'none') === 'pending') {
      return res.status(403).json({ success: false, message: 'You already have a pending profile review. Please wait for admin approval or rejection.' });
    }

    const account = (req.body.bank_account_number || '').trim();
    const ifsc = (req.body.bank_ifsc_code || '').trim().toUpperCase();
    const bankName = (req.body.bank_name || '').trim();
    if (!/^\d{9,20}$/.test(account)) return res.status(400).json({ success: false, message: 'Enter a valid account number.' });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return res.status(400).json({ success: false, message: 'Enter a valid IFSC code.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Bank proof document is required.' });
    const { fileUrl } = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype, { userId: String(userId), category: 'bank_proof' });
    let verified = false;
    let holderName = null;
    try {
      const verificationResult = await new Promise((resolve) => {
        const mockRes = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(payload) {
            resolve({ statusCode: this.statusCode || 200, payload });
            return payload;
          },
        };

        exports.verifyBankAccount(
          {
            body: {
              account_number: account,
              ifsc,
              account_holder_name: req.user?.full_name || '',
            },
            user: req.user,
          },
          mockRes,
          () => resolve({ statusCode: 500, payload: { success: false } })
        );
      });

      verified = verificationResult?.payload?.success === true && verificationResult?.payload?.data?.verified === true;
      holderName = verificationResult?.payload?.data?.account_holder_name || null;
    } catch (_) {}
    const upd = { bank_account_number: account, bank_ifsc_code: ifsc, bank_name: bankName, bank_proof_url: fileUrl, bank_verified: verified, bank_change_status: verified ? 'verified' : 'pending_review' };
    if (holderName) upd.bank_account_holder_name = holderName;

    if (verified) {
      await User.findByIdAndUpdate(userId, upd);
    } else {
      await User.findByIdAndUpdate(userId, {
        profile_edit_status: 'pending',
        pending_profile_changes: {
          ...(currentUser.pending_profile_changes || {}),
          ...upd,
        },
        profile_edit_requested_at: new Date(),
        profile_edit_rejection_reason: null,
        profile_edit_rejection_fields: [],
      });
    }

    try {
      const { Notification } = require('../models');
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, is_active: true }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map(a => ({
          user_id: a._id,
          type: 'profile_edit_request',
          title: verified ? 'Bank Details Auto-Verified' : 'Bank Change Review Needed',
          message: (currentUser.full_name || req.user.full_name || 'A member') + (verified
            ? ' updated bank details (Cashfree verified).'
            : ' submitted bank details for approval.'),
          data: { request_user_id: String(userId), changes: upd, verified },
        })));
      }
    } catch (_) {}

    res.json({ success: true, message: verified ? 'Bank account verified and updated.' : 'Bank details submitted. Admin will verify within 24 hours.', verified });
  } catch (err) { next(err); }
};
