const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Document } = require('../models');

const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
const s3 = USE_S3 ? new AWS.S3({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }) : null;
const BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/documents');

function buildFileUrl(s3Key) {
  if (CLOUDFRONT_URL) return CLOUDFRONT_URL + '/' + s3Key;
  return 'https://' + BUCKET + '.s3.' + process.env.AWS_REGION + '.amazonaws.com/' + s3Key;
}

exports.getMyDocuments = async (req, res, next) => {
  try {
    const docs = await Document.find({ user_id: req.user._id || req.user.id }).sort({ created_at: -1 });
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const { document_type, chit_group_id } = req.body;
    if (!document_type) return res.status(400).json({ success: false, message: 'document_type required' });

    const VALID_TYPES = ['aadhaar_card', 'pan_card', 'cancelled_cheque', 'selfie_photo'];
    if (!VALID_TYPES.includes(document_type)) {
      return res.status(400).json({ success: false, message: 'Invalid document type. Allowed: ' + VALID_TYPES.join(', ') });
    }

    const DOC_SIZE_LIMITS = { aadhaar_card: 500 * 1024, pan_card: 200 * 1024, cancelled_cheque: 400 * 1024, selfie_photo: 150 * 1024 };
    const maxSize = DOC_SIZE_LIMITS[document_type];
    if (maxSize && req.file.size > maxSize) {
      const limitKB = Math.round(maxSize / 1024);
      return res.status(400).json({ success: false, message: `File too large for ${document_type.replace(/_/g, ' ')}. Maximum allowed: ${limitKB} KB` });
    }

    const ext = path.extname(req.file.originalname);
    const fileName = uuidv4() + ext;
    let fileUrl, s3Key = null;

    if (USE_S3) {
      s3Key = 'documents/' + (req.user._id || req.user.id) + '/' + fileName;
      await s3.upload({ Bucket: BUCKET, Key: s3Key, Body: req.file.buffer, ContentType: req.file.mimetype, ServerSideEncryption: 'AES256' }).promise();
      fileUrl = buildFileUrl(s3Key);
    } else {
      if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileName), req.file.buffer);
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:' + (process.env.PORT || 5000);
      fileUrl = baseUrl + '/uploads/documents/' + fileName;
    }

    const doc = await Document.create({
      user_id: req.user._id || req.user.id,
      chit_group_id: chit_group_id || null,
      document_type,
      document_name: req.file.originalname,
      file_name: req.file.originalname,
      file_url: fileUrl,
      s3_key: s3Key,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    });
    res.status(201).json({ success: true, message: 'Document uploaded', data: doc });
  } catch (err) { next(err); }
};

exports.getDocumentById = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user_id: req.user._id || req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user_id: req.user._id || req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (doc.s3_key && USE_S3) {
      await s3.deleteObject({ Bucket: BUCKET, Key: doc.s3_key }).promise();
    } else if (!USE_S3 && doc.file_url) {
      const local = path.join(LOCAL_UPLOAD_DIR, path.basename(doc.file_url));
      if (fs.existsSync(local)) fs.unlinkSync(local);
    }
    await Document.findByIdAndDelete(doc._id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
};
