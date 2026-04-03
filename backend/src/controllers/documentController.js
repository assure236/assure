const { Document } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../utils/gridfs');

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

    const userId = req.user._id || req.user.id;

    // Remove previous document of the same type for this user
    const existingDoc = await Document.findOne({ user_id: userId, document_type });
    if (existingDoc) {
      if (existingDoc.gridfs_id) {
        try { await deleteFromGridFS(existingDoc.gridfs_id); } catch (e) { /* already deleted */ }
      }
      await Document.findByIdAndDelete(existingDoc._id);
    }

    const { fileId, fileUrl } = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype, {
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
    if (doc.gridfs_id) {
      try { await deleteFromGridFS(doc.gridfs_id); } catch (e) { /* file might already be deleted */ }
    }
    await Document.findByIdAndDelete(doc._id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
};
