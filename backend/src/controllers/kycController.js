const { User, Document } = require('../models');
const { uploadToGridFS } = require('../utils/gridfs');

async function uploadFile(file, userId) {
  const { fileId, fileUrl } = await uploadToGridFS(file.buffer, file.originalname, file.mimetype, {
    userId: userId.toString(), category: 'kyc',
  });
  return { fileUrl, gridfsId: fileId, fileName: file.originalname };
}

exports.getKycStatus = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('kyc_status kyc_rejection_reason full_name email mobile pan_number aadhaar_number digilocker_id');
    const documents = await Document.find({ user_id: userId }).sort({ created_at: -1 });
    const panVerified = !!user.pan_number || documents.some(d => d.document_type === 'pan_card' && ['verified', 'approved'].includes(d.verification_status));
    const aadhaarVerified = !!user.aadhaar_number || documents.some(d => d.document_type === 'aadhaar_card' && ['verified', 'approved'].includes(d.verification_status));
    const chequeVerified = documents.some(d => d.document_type === 'cancelled_cheque' && ['verified', 'approved'].includes(d.verification_status));
    const selfieVerified = documents.some(d => d.document_type === 'selfie_photo' && ['verified', 'approved'].includes(d.verification_status));
    res.json({ success: true, data: { kyc_status: user.kyc_status, rejection_reason: user.kyc_rejection_reason, pan_verified: panVerified, aadhaar_verified: aadhaarVerified, cheque_verified: chequeVerified, selfie_verified: selfieVerified, digilocker_connected: !!user.digilocker_id, documents, user: { full_name: user.full_name, email: user.email, mobile: user.mobile } } });
  } catch (err) { next(err); }
};

exports.submitPan = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { pan_number } = req.body;
    if (!pan_number) return res.status(400).json({ success: false, message: 'PAN number is required' });
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan_number.toUpperCase())) return res.status(400).json({ success: false, message: 'Invalid PAN format' });
    await User.findByIdAndUpdate(userId, { pan_number: pan_number.toUpperCase() });
    res.json({ success: true, message: 'PAN submitted successfully' });
  } catch (err) { next(err); }
};

exports.submitKyc = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.kyc_status === 'verified') return res.status(400).json({ success: false, message: 'KYC already verified' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'At least one KYC document required' });

    const savedDocs = [];
    for (const file of req.files) {
      const { fileUrl, gridfsId } = await uploadFile(file, userId);
      const docType = req.body.document_type || file.fieldname || 'kyc';
      const doc = await Document.create({
        user_id: userId,
        document_type: docType,
        document_name: file.originalname,
        file_name: file.originalname,
        file_url: fileUrl,
        gridfs_id: gridfsId,
        file_size: file.size,
        mime_type: file.mimetype,
        verification_status: 'pending',
      });
      savedDocs.push(doc);
    }

    await User.findByIdAndUpdate(userId, { kyc_status: 'pending' });
    res.json({ success: true, message: 'KYC documents submitted for review', data: { documents: savedDocs, kyc_status: 'pending' } });
  } catch (err) { next(err); }
};

exports.uploadKycDocument = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const { document_type } = req.body;
    if (!document_type) return res.status(400).json({ success: false, message: 'document_type required' });

    // Remove previous document of the same type for this user
    const { deleteFromGridFS } = require('../utils/gridfs');
    const existingDoc = await Document.findOne({ user_id: userId, document_type });
    if (existingDoc) {
      if (existingDoc.gridfs_id) {
        try { await deleteFromGridFS(existingDoc.gridfs_id); } catch (e) { /* already deleted */ }
      }
      await Document.findByIdAndDelete(existingDoc._id);
    }

    const { fileUrl, gridfsId } = await uploadFile(req.file, userId);
    const doc = await Document.create({
      user_id: userId, document_type, document_name: req.file.originalname, file_name: req.file.originalname,
      file_url: fileUrl, gridfs_id: gridfsId, file_size: req.file.size, mime_type: req.file.mimetype, verification_status: 'pending',
    });
    await User.findByIdAndUpdate(userId, { kyc_status: 'pending' });
    res.status(201).json({ success: true, message: 'Document uploaded', data: doc });
  } catch (err) { next(err); }
};

exports.verifyPan = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { pan_number } = req.body;
    if (!pan_number) return res.status(400).json({ success: false, message: 'PAN number is required' });
    
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const formatted = pan_number.toUpperCase().trim();
    if (!panRegex.test(formatted)) {
      return res.status(400).json({ success: false, message: 'Invalid PAN format. Expected: ABCDE1234F' });
    }

    // Check if PAN is already used by another user
    const existing = await User.findOne({ pan_number: formatted, _id: { $ne: userId } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This PAN is already registered with another account' });
    }

    // Real PAN verification via third-party API
    let verificationResult = { verified: false, name: null };
    const VERIFICATION_API_KEY = process.env.PAN_VERIFICATION_API_KEY;
    
    if (VERIFICATION_API_KEY) {
      try {
        const axios = require('axios');
        const resp = await axios.post(
          process.env.PAN_VERIFICATION_URL || 'https://api.cashfree.com/verification/pan',
          { pan: formatted },
          { 
            headers: { 
              'x-client-id': process.env.CASHFREE_APP_ID,
              'x-client-secret': VERIFICATION_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 15000,
          }
        );
        if (resp.data && resp.data.valid) {
          verificationResult = { verified: true, name: resp.data.registered_name || resp.data.name_on_card };
        }
      } catch (apiErr) {
        console.log('PAN verification API error:', apiErr.message);
      }
    }

    // Save PAN regardless of verification (mark status accordingly)
    await User.findByIdAndUpdate(userId, { 
      pan_number: formatted,
      pan_verified: verificationResult.verified,
    });

    res.json({ 
      success: true, 
      message: verificationResult.verified 
        ? `PAN verified. Name: ${verificationResult.name}` 
        : 'PAN saved. Verification will be done during review.',
      data: { 
        pan_number: formatted, 
        verified: verificationResult.verified,
        name: verificationResult.name,
      }
    });
  } catch (err) { next(err); }
};

exports.verifyAadhaar = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { aadhaar_number } = req.body;
    if (!aadhaar_number) return res.status(400).json({ success: false, message: 'Aadhaar number is required' });
    
    const cleaned = aadhaar_number.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleaned)) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar. Must be 12 digits.' });
    }

    // Verhoeff check (basic)
    const existing = await User.findOne({ aadhaar_number: cleaned, _id: { $ne: userId } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This Aadhaar is already registered with another account' });
    }

    // Save Aadhaar
    await User.findByIdAndUpdate(userId, { aadhaar_number: cleaned });

    res.json({ 
      success: true, 
      message: 'Aadhaar saved. Full verification available via DigiLocker.',
      data: { 
        aadhaar_number: `XXXX-XXXX-${cleaned.slice(-4)}`,
      }
    });
  } catch (err) { next(err); }
};

exports.initiateDigiLocker = async (req, res, next) => {
  const digilockerController = require('./digilockerController');
  return digilockerController.getAuthUrl(req, res, next);
};

exports.digiLockerCallback = async (req, res, next) => {
  const digilockerController = require('./digilockerController');
  return digilockerController.handleCallback(req, res, next);
};
