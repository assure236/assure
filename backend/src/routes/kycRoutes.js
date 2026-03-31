const express = require('express');
const router = express.Router();
const multer = require('multer');
const kycController = require('../controllers/kycController');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
  }
});

// @route   GET /api/v1/kyc/status
router.get('/status', authMiddleware, kycController.getKycStatus);

// @route   POST /api/v1/kyc/submit-pan
router.post('/submit-pan', authMiddleware, kycController.submitPan);

// @route   POST /api/v1/kyc/submit
// @desc    Submit KYC documents (multiple files)
router.post('/submit', authMiddleware, upload.array('documents', 5), kycController.submitKyc);

// @route   POST /api/v1/kyc/upload-document
// @desc    Upload a single KYC document
router.post('/upload-document', authMiddleware, upload.single('document'), kycController.uploadKycDocument);

// @route   GET /api/v1/kyc/digilocker/init
router.get('/digilocker/init', authMiddleware, kycController.initiateDigiLocker);

// @route   GET /api/v1/kyc/digilocker/callback
router.get('/digilocker/callback', kycController.digiLockerCallback);

module.exports = router;
