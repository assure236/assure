const express = require('express');
const router = express.Router();
const { downloadFromGridFS } = require('../utils/gridfs');

// GET /api/v1/files/:id — serve a file from MongoDB GridFS (public endpoint)
router.get('/:id', async (req, res, next) => {
  try {
    const result = await downloadFromGridFS(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'File not found' });

    const { stream, file } = result;
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Length', file.length);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
    // Let browser display images/PDFs inline
    const inline = (file.contentType || '').startsWith('image/') || file.contentType === 'application/pdf';
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
