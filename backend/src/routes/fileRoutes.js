const express = require('express');
const router = express.Router();
const { downloadFromGridFS } = require('../utils/gridfs');
const { authMiddleware } = require('../middleware/auth');
const { Document } = require('../models');

// SECURITY FIX: require authentication before serving files.
router.use(authMiddleware);

// GET /api/v1/files/:id — serve a file from MongoDB GridFS
router.get('/:id', async (req, res, next) => {
  try {
    const result = await downloadFromGridFS(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'File not found' });

    const { stream, file } = result;
    const role = String(req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'super_admin' || role === 'manager';
    const requestUserId = String(req.user?._id || req.user?.id || '');
    const fileUserId = String(file?.metadata?.userId || '');
    // SECURITY FIX: enforce ownership/role authorization for GridFS files.
    if (!isAdmin) {
      const linkedDoc = await Document.findOne({ gridfs_id: String(req.params.id), user_id: requestUserId }).select('_id');
      if (!linkedDoc && (!fileUserId || fileUserId !== requestUserId)) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
    }
    const contentType = file.contentType || (file.metadata && file.metadata.mimetype) || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Content-Length', file.length);
    // SECURITY FIX: private cache policy to avoid proxy caching private files.
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    // SECURITY FIX: restrict CORS to known trusted origins.
    const allowedOrigins = [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL].filter(Boolean);
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    // Let browser display images/PDFs inline
    const inline = contentType.startsWith('image/') || contentType === 'application/pdf';
    res.set('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + (file.filename || 'file') + '"');
    stream.pipe(res);
  } catch (err) {
    if (err.message && err.message.includes('Argument passed in must be a single String of 12 bytes')) {
      return res.status(400).json({ success: false, message: 'Invalid file ID' });
    }
    next(err);
  }
});

module.exports = router;
