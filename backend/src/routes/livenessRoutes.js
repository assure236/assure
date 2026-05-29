const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const { authMiddleware } = require('../middleware/auth');
const { Document, User } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const LUXAND_API = 'https://api.luxand.cloud';
const LUXAND_TOKEN = process.env.LUXAND_API_TOKEN;
const SELFIE_TARGET = 300 * 1024; // 300 KB
const LIVENESS_UPLOAD_TARGET = 700 * 1024; // Keep provider upload lean for better stability
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
  const code = (err && err.code ? String(err.code) : '').toUpperCase();

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return 'Liveness service timeout. Please retry in a few seconds.';
  }
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'EAI_AGAIN') {
    return 'Liveness service is temporarily unreachable. Please try again.';
  }

  if (err?.name === 'AbortError' || msg.includes('abort') || msg.includes('timed out') || msg.includes('timeout')) {
    return 'Liveness service timeout. Please retry in a few seconds.';
  }
  if (msg.includes('terminated') || msg.includes('fetch failed') || msg.includes('network')) {
    return 'Liveness service is temporarily unreachable. Please try again.';
  }
  return 'Liveness verification failed. Please try again.';
}

function isTransientLivenessError(err) {
  const msg = (err && err.message ? err.message : '').toLowerCase();
  const code = (err && err.code ? String(err.code) : '').toUpperCase();
  return (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'EAI_AGAIN' ||
    msg.includes('terminated') ||
    msg.includes('timeout') ||
    msg.includes('stream has been aborted') ||
    msg.includes('fetch failed')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLuxandLiveness(buffer, mimetype, originalname) {
  let uploadBuffer = buffer;
  let uploadMime = mimetype || 'image/jpeg';

  if (uploadBuffer.length > LIVENESS_UPLOAD_TARGET) {
    uploadBuffer = await compressImage(uploadBuffer, LIVENESS_UPLOAD_TARGET);
    uploadMime = 'image/jpeg';
  }

  let lastError = null;

  for (let attempt = 1; attempt <= LIVENESS_MAX_RETRIES; attempt += 1) {
    const form = new FormData();
    form.append('photo', uploadBuffer, {
      filename: originalname || 'photo.jpg',
      contentType: uploadMime,
    });

    try {
      const response = await axios.post(`${LUXAND_API}/photo/liveness`, form, {
        headers: {
          ...form.getHeaders(),
          token: LUXAND_TOKEN,
        },
        timeout: LIVENESS_TIMEOUT_MS,
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: () => true,
      });

      const data = typeof response.data === 'object'
        ? response.data
        : { status: 'failure', message: 'Invalid response from liveness provider' };

      if (response.status < 200 || response.status >= 300) {
        if (response.status >= 500 && attempt < LIVENESS_MAX_RETRIES) {
          await sleep(500 * attempt);
          continue;
        }
        return {
          status: 'failure',
          message: data.message || `Liveness provider error (${response.status})`,
        };
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt < LIVENESS_MAX_RETRIES) {
        const code = err && err.code ? err.code : 'UNKNOWN';
        console.warn(`Luxand liveness attempt ${attempt} failed (${code}): ${err.message}`);
        await sleep(500 * attempt);
      }
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
    console.error('Liveness check error:', err.code || 'NO_CODE', err.message);
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
    let data = null;
    let livenessDeferred = false;
    try {
      data = await callLuxandLiveness(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (data.status === 'failure') {
        return res.json({ success: false, live: false, message: data.message || 'No face detected' });
      }
      if (data.result !== 'real') {
        return res.json({
          success: false, live: false, liveness: data.result, score: data.score,
          message: 'Spoof detected — please use a real face',
        });
      }
    } catch (err) {
      if (!isTransientLivenessError(err)) {
        throw err;
      }
      livenessDeferred = true;
      console.warn('Liveness provider unavailable, saving selfie with deferred verification:', err.code || 'NO_CODE', err.message);
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
      verification_status: livenessDeferred ? 'pending' : 'approved',
      notes: livenessDeferred ? 'Liveness verification deferred due to provider unavailability' : undefined,
    });

    // 5. Also set as profile photo so user doesn't need to upload separately
    await User.findByIdAndUpdate(userId, { profile_image_url: fileUrl });

    return res.json({
      success: true,
      live: livenessDeferred ? null : true,
      liveness: livenessDeferred ? 'deferred' : data.result,
      score: livenessDeferred ? null : data.score,
      message: livenessDeferred
        ? 'Selfie saved successfully. Liveness verification is temporarily deferred and will be reviewed.'
        : 'Verified — selfie saved as profile photo',
      data: doc,
      file_url: fileUrl,
      verification_deferred: livenessDeferred,
    });
  } catch (err) {
    console.error('Liveness verify-and-save error:', err.code || 'NO_CODE', err.message);
    return res.status(500).json({ success: false, message: mapLivenessError(err) });
  }
});

module.exports = router;
