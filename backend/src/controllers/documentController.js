const { Document, User } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');
const sharp = require('sharp');

const LUXAND_API = 'https://api.luxand.cloud';
const LUXAND_TOKEN = process.env.LUXAND_API_TOKEN;

// Target sizes per document type (bytes)
const DOC_SIZE_LIMITS = {
  aadhaar_card: 500 * 1024,     // 500 KB
  pan_card: 200 * 1024,         // 200 KB
  cancelled_cheque: 400 * 1024, // 400 KB
  selfie_photo: 300 * 1024,     // 300 KB
};

async function compressImage(buffer, targetSize) {
  let quality = 85;
  let result = buffer;
  // Resize to max 1200px and progressively lower quality until within target
  while (result.length > targetSize && quality > 15) {
    result = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    quality -= 10;
  }
  return result;
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

    const userId = req.user._id || req.user.id;

    // Remove previous document of the same type for this user
    const existingDoc = await Document.findOne({ user_id: userId, document_type });
    if (existingDoc) {
      if (existingDoc.gridfs_id) {
        try { await deleteFromGridFS(existingDoc.gridfs_id); } catch (e) { /* already deleted */ }
      }
      await Document.findByIdAndDelete(existingDoc._id);
    }

    // Auto-compress image to fit within target size
    const targetSize = DOC_SIZE_LIMITS[document_type] || 500 * 1024;
    let fileBuffer = req.file.buffer;
    let fileMime = req.file.mimetype;
    if (fileBuffer.length > targetSize) {
      fileBuffer = await compressImage(fileBuffer, targetSize);
      fileMime = 'image/jpeg';
    }

    // ── Selfie liveness check (replaces separate /liveness/check call) ──────
    if (document_type === 'selfie_photo') {
      if (!LUXAND_TOKEN) {
        return res.status(500).json({ success: false, message: 'Liveness check service not configured' });
      }
      const form = new FormData();
      const blob = new Blob([fileBuffer], { type: fileMime });
      form.append('photo', blob, req.file.originalname || 'photo.jpg');
      let luxandData;
      try {
        const luxandRes = await fetch(`${LUXAND_API}/photo/liveness`, {
          method: 'POST',
          headers: { token: LUXAND_TOKEN },
          body: form,
        });
        luxandData = await luxandRes.json();
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Liveness check failed. Check connection.' });
      }
      const isLive = luxandData.status === 'success' && luxandData.result === 'real';
      if (!isLive) {
        const msg = luxandData.result === 'spoof'
          ? 'Spoof detected — please use a real face in good lighting'
          : (luxandData.message || 'No face detected. Please take a clear selfie.');
        return res.status(400).json({ success: false, live: false, message: msg });
      }
    }

    const { fileId, fileUrl } = await uploadToGridFS(fileBuffer, req.file.originalname, fileMime, {
      userId: userId.toString(), category: 'documents', documentType: document_type,
    });

    const doc = await Document.create({
      user_id: userId,
      chit_group_id: chit_group_id || null,
      document_type,
      document_name: req.file.originalname,
      file_name: req.file.originalname,
      file_url: fileUrl,
      gridfs_id: fileId,
      file_size: fileBuffer.length,
      mime_type: fileMime,
    });

    // ── Auto-set profile photo when selfie passes liveness ───────────────────
    if (document_type === 'selfie_photo') {
      await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl });
    }

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
    if (doc.gridfs_id) {
      try { await deleteFromGridFS(doc.gridfs_id); } catch (e) { /* file might already be deleted */ }
    }
    await Document.findByIdAndDelete(doc._id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
};
