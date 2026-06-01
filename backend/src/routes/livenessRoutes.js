const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { authMiddleware } = require('../middleware/auth');
const { Document, User } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const SELFIE_TARGET = 300 * 1024;
const SELFIE_MIN_CONFIDENCE_PERCENT = Number(process.env.SELFIE_MIN_CONFIDENCE_PERCENT || 55);

async function compressImage(buffer, targetSize) {
  let quality = 85;
  let result = buffer;
  while (result.length > targetSize && quality > 15) {
    result = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    quality -= 10;
  }
  return result;
}

// POST /liveness/check — compatibility endpoint.
router.post('/check', authMiddleware, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });

  const confidenceRaw = Number(req.body?.confidence_percent);
  const confidencePercent = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : null;

  if (confidencePercent !== null && confidencePercent < SELFIE_MIN_CONFIDENCE_PERCENT) {
    return res.status(400).json({
      success: false,
      live: false,
      confidence_percent: confidencePercent,
      min_required_percent: SELFIE_MIN_CONFIDENCE_PERCENT,
      message: 'Face confidence is low. Improve lighting and keep only your face in frame.',
    });
  }

  return res.json({
    success: true,
    live: true,
    confidence_percent: confidencePercent,
    message: 'Selfie captured successfully.',
  });
});

// POST /liveness/verify-and-save — save selfie + set profile photo.
router.post('/verify-and-save', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });

    const confidenceRaw = Number(req.body?.confidence_percent);
    const confidencePercent = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
      : null;

    if (confidencePercent !== null && confidencePercent < SELFIE_MIN_CONFIDENCE_PERCENT) {
      return res.status(400).json({
        success: false,
        live: false,
        confidence_percent: confidencePercent,
        min_required_percent: SELFIE_MIN_CONFIDENCE_PERCENT,
        message: 'Face confidence is low. Improve lighting and keep only your face in frame.',
      });
    }

    const userId = req.user._id || req.user.id;
    let buf = req.file.buffer;
    let mime = req.file.mimetype;

    if (buf.length > SELFIE_TARGET) {
      buf = await compressImage(buf, SELFIE_TARGET);
      mime = 'image/jpeg';
    }

    const existing = await Document.findOne({ user_id: userId, document_type: 'selfie_photo' });
    if (existing) {
      if (existing.gridfs_id) {
        try { await deleteFromGridFS(existing.gridfs_id); } catch (_) {}
      }
      await Document.findByIdAndDelete(existing._id);
    }

    const { fileId, fileUrl } = await uploadToGridFS(buf, req.file.originalname || 'selfie.jpg', mime, {
      userId: userId.toString(), category: 'documents', documentType: 'selfie_photo',
    });

    const doc = await Document.create({
      user_id: userId,
      document_type: 'selfie_photo',
      document_name: req.file.originalname || 'selfie.jpg',
      file_name: req.file.originalname || 'selfie.jpg',
      file_url: fileUrl,
      gridfs_id: fileId,
      file_size: buf.length,
      mime_type: mime,
      verification_status: 'approved',
      notes: 'Selfie saved',
    });

    await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl });

    return res.json({
      success: true,
      live: true,
      liveness: 'not_applicable',
      score: confidencePercent !== null ? confidencePercent / 100 : null,
      confidence_percent: confidencePercent,
      message: 'Selfie saved as profile photo.',
      data: doc,
      file_url: fileUrl,
      verification_deferred: false,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Selfie upload failed. Please try again.' });
  }
});

module.exports = router;
