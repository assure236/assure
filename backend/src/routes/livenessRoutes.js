const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const LUXAND_API = 'https://api.luxand.cloud';
const LUXAND_TOKEN = process.env.LUXAND_API_TOKEN;

// POST /liveness/check — proxy photo to Luxand liveness API
router.post('/check', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }
    if (!LUXAND_TOKEN) {
      return res.status(500).json({ success: false, message: 'Liveness service not configured' });
    }

    // Use Node 20 native FormData + Blob (npm form-data doesn't work with native fetch)
    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'image/jpeg' });
    form.append('photo', blob, req.file.originalname || 'photo.jpg');

    const response = await fetch(`${LUXAND_API}/photo/liveness`, {
      method: 'POST',
      headers: { token: LUXAND_TOKEN },
      body: form,
    });

    const data = await response.json();

    // Luxand returns: { status: "success", liveness: "real" | "spoof" } or { status: "failure", message: "..." }
    if (data.status === 'failure') {
      return res.json({ success: false, live: false, message: data.message || 'No face detected' });
    }

    const isLive = data.liveness === 'real';
    return res.json({
      success: true,
      live: isLive,
      liveness: data.liveness,
      message: isLive ? 'Real face detected' : 'Spoof detected — use a real face',
    });
  } catch (err) {
    console.error('Liveness check error:', err.message);
    return res.status(500).json({ success: false, message: 'Liveness check failed' });
  }
});

module.exports = router;
