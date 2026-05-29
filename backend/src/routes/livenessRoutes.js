const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { authMiddleware } = require('../middleware/auth');
const { Document, User } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const LUXAND_API = 'https://api.luxand.cloud';
const LUXAND_TOKEN = process.env.LUXAND_API_TOKEN;
const SELFIE_TARGET = 300 * 1024; // 300 KB
const LIVENESS_TIMEOUT_MS = 25000;
const LIVENESS_MAX_RETRIES = 2;

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

function mapLivenessError(err) {
  const msg = (err && err.message ? err.message : '').toLowerCase();
  if (err?.name === 'AbortError' || msg.includes('abort') || msg.includes('timed out') || msg.includes('timeout')) {
    return 'Liveness service timeout. Please retry in a few seconds.';
  }
  if (msg.includes('terminated') || msg.includes('fetch failed') || msg.includes('network')) {
    return 'Liveness service is temporarily unreachable. Please try again.';
  }
  return 'Liveness verification failed. Please try again.';
}

async function callLuxandLiveness(buffer, mimetype, originalname) {
  let lastError = null;

  for (let attempt = 1; attempt <= LIVENESS_MAX_RETRIES; attempt += 1) {
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimetype || 'image/jpeg' });
    form.append('photo', blob, originalname || 'photo.jpg');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT_MS);

    try {
      const response = await fetch(`${LUXAND_API}/photo/liveness`, {
        method: 'POST',
        headers: { token: LUXAND_TOKEN },
        body: form,
        signal: controller.signal,
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { status: 'failure', message: 'Invalid response from liveness provider' };
      }

      if (!response.ok) {
        return {
          status: 'failure',
          message: data.message || `Liveness provider error (${response.status})`,
        };
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt < LIVENESS_MAX_RETRIES) {
        console.warn(`Luxand liveness attempt ${attempt} failed: ${err.message}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('Liveness request failed');
}

// POST /liveness/check — verify only (no save). Kept for backwards-compat.
router.post('/check', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });
    if (!LUXAND_TOKEN) return res.status(500).json({ success: false, message: 'Liveness service not configured' });

    const data = await callLuxandLiveness(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (data.status === 'failure') {
      return res.json({ success: false, live: false, message: data.message || 'No face detected' });
    }
    const isLive = data.result === 'real';
    return res.json({
      success: true, live: isLive, liveness: data.result, score: data.score,
      message: isLive ? 'Real face detected' : 'Spoof detected — use a real face',
    });
  } catch (err) {
    console.error('Liveness check error:', err.message);
    return res.status(500).json({ success: false, message: mapLivenessError(err) });
  }
});

// POST /liveness/verify-and-save — single-call: liveness + save selfie + set profile photo
// Replaces the old 2-call flow (liveness/check then documents/upload) to halve backend traffic.
router.post('/verify-and-save', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });
    if (!LUXAND_TOKEN) return res.status(500).json({ success: false, message: 'Liveness service not configured' });

    // 1. Luxand liveness check
    const data = await callLuxandLiveness(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (data.status === 'failure') {
      return res.json({ success: false, live: false, message: data.message || 'No face detected' });
    }
    if (data.result !== 'real') {
      return res.json({
        success: false, live: false, liveness: data.result, score: data.score,
        message: 'Spoof detected — please use a real face',
      });
    }

    // 2. Compress + upload to GridFS
    const userId = req.user._id || req.user.id;
    let buf = req.file.buffer;
    let mime = req.file.mimetype;
    if (buf.length > SELFIE_TARGET) {
      buf = await compressImage(buf, SELFIE_TARGET);
      mime = 'image/jpeg';
    }

    // 3. Remove previous selfie document (if any)
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

    // 4. Save Document record
    const doc = await Document.create({
      user_id: userId,
      document_type: 'selfie_photo',
      document_name: req.file.originalname || 'selfie.jpg',
      file_name: req.file.originalname || 'selfie.jpg',
      file_url: fileUrl,
      gridfs_id: fileId,
      file_size: buf.length,
      mime_type: mime,
    });

    // 5. Also set as profile photo so user doesn't need to upload separately
    await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl });

    return res.json({
      success: true,
      live: true,
      liveness: data.result,
      score: data.score,
      message: 'Verified — selfie saved as profile photo',
      data: doc,
      file_url: fileUrl,
    });
  } catch (err) {
    console.error('Liveness verify-and-save error:', err.message);
    return res.status(500).json({ success: false, message: mapLivenessError(err) });
  }
});

module.exports = router;
