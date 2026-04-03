const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentRoutes = require('../controllers/documentController');
const { authMiddleware } = require('../middleware/auth');

// Use memory storage so the controller can decide where to store (S3 or local)
// Per-document-type max sizes (in bytes)
const DOC_SIZE_LIMITS = {
  aadhaar_card: 500 * 1024,     // 500 KB
  pan_card: 200 * 1024,         // 200 KB
  cancelled_cheque: 400 * 1024, // 400 KB
  selfie_photo: 150 * 1024,     // 150 KB
};
const MAX_FILE_SIZE = 500 * 1024; // 500 KB absolute max

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG and PNG images are allowed'));
    }
  }
});

router.use(authMiddleware);

router.get('/', documentRoutes.getMyDocuments);
router.post('/upload', upload.single('document'), documentRoutes.uploadDocument);
router.get('/:id', documentRoutes.getDocumentById);
router.delete('/:id', documentRoutes.deleteDocument);

module.exports = router;
