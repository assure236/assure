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
