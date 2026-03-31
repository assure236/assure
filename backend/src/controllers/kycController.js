const AWS = require('aws-sdk');
const { User, Document } = require('../models');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
const s3 = USE_S3 ? new AWS.S3({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }) : null;
const BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/kyc');

function buildFileUrl(s3Key) {
  if (CLOUDFRONT_URL) return CLOUDFRONT_URL + '/' + s3Key;
  return 'https://' + BUCKET + '.s3.' + process.env.AWS_REGION + '.amazonaws.com/' + s3Key;
}

async function uploadFile(file, userId) {
  const ext = path.extname(file.originalname);
  const fileName = uuidv4() + ext;
  let fileUrl, s3Key = null;

  if (USE_S3) {
    s3Key = 'kyc/' + userId + '/' + fileName;
    await s3.upload({ Bucket: BUCKET, Key: s3Key, Body: file.buffer, ContentType: file.mimetype, ServerSideEncryption: 'AES256' }).promise();
    fileUrl = buildFileUrl(s3Key);
  } else {
    if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileName), file.buffer);
    const baseUrl = process.env.BACKEND_URL || ('http://localhost:' + (process.env.PORT || 5000));
    fileUrl = baseUrl + '/uploads/kyc/' + fileName;
  }

  return { fileUrl, s3Key, fileName };
}

exports.getKycStatus = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select('kyc_status kyc_rejection_reason full_name email mobile pan_number aadhaar_number');
    const documents = await Document.find({ user_id: userId }).sort({ created_at: -1 });
    const panVerified = !!user.pan_number || documents.some(d => d.document_type === 'pan_card' && ['verified', 'approved'].includes(d.verification_status));
    const aadhaarVerified = !!user.aadhaar_number || documents.some(d => d.document_type === 'aadhaar_card' && ['verified', 'approved'].includes(d.verification_status));
    const chequeVerified = documents.some(d => d.document_type === 'cancelled_cheque' && ['verified', 'approved'].includes(d.verification_status));
    const selfieVerified = documents.some(d => d.document_type === 'selfie_photo' && ['verified', 'approved'].includes(d.verification_status));
    res.json({ success: true, data: { kyc_status: user.kyc_status, rejection_reason: user.kyc_rejection_reason, pan_verified: panVerified, aadhaar_verified: aadhaarVerified, cheque_verified: chequeVerified, selfie_verified: selfieVerified, documents, user: { full_name: user.full_name, email: user.email, mobile: user.mobile } } });
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
      const { fileUrl, s3Key } = await uploadFile(file, userId);
      const docType = req.body.document_type || file.fieldname || 'kyc';
      const doc = await Document.create({
        user_id: userId,
        document_type: docType,
        document_name: file.originalname,
        file_name: file.originalname,
        file_url: fileUrl,
        s3_key: s3Key,
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
    const { fileUrl, s3Key } = await uploadFile(req.file, userId);
    const doc = await Document.create({
      user_id: userId, document_type, document_name: req.file.originalname, file_name: req.file.originalname,
      file_url: fileUrl, s3_key: s3Key, file_size: req.file.size, mime_type: req.file.mimetype, verification_status: 'pending',
    });
    await User.findByIdAndUpdate(userId, { kyc_status: 'pending' });
    res.status(201).json({ success: true, message: 'Document uploaded', data: doc });
  } catch (err) { next(err); }
};

exports.initiateDigiLocker = async (req, res) => {
  res.status(503).json({ success: false, message: 'DigiLocker integration not configured. Please set DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET in .env' });
};

exports.digiLockerCallback = async (req, res) => {
  res.status(503).json({ success: false, message: 'DigiLocker integration not configured.' });
};
