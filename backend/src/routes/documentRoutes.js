const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentRoutes = require('../controllers/documentController');
const { authMiddleware } = require('../middleware/auth');

// Use memory storage — images are auto-compressed in the controller before saving
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB — accept any camera photo

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/octet-stream'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const ext = (file.originalname || '').split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) return cb(null, true);
      cb(new Error('Only JPG, JPEG, PNG and PDF files are allowed'));
    }
  }
});

router.use(authMiddleware);

router.get('/', documentRoutes.getMyDocuments);
router.post('/upload', upload.single('document'), documentRoutes.uploadDocument);
router.post('/attach', upload.single('document'), documentRoutes.attachDocument);
router.get('/:id', documentRoutes.getDocumentById);
router.delete('/:id', documentRoutes.deleteDocument);

module.exports = router;
