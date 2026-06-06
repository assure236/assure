const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { authMiddleware } = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes require auth
router.use(authMiddleware);

// Status
router.get('/status', onboardingController.getStatus);

// Step 1: KYC via Cashfree VRS — PAN + Aadhaar OTP verification
router.post('/digilocker/create-url', onboardingController.createCashfreeDigilockerUrl);
router.post('/digilocker/sync', onboardingController.syncCashfreeDigilocker);
router.post('/verify-pan', onboardingController.verifyPanKyc);
router.post('/aadhaar/send-otp', onboardingController.sendAadhaarOtp);
router.post('/aadhaar/verify-otp', onboardingController.verifyAadhaarOtp);

// Step 1 (legacy): DigiLocker (link to existing init via /digilocker/auth-url)
//         If user has no DigiLocker, submit manual PAN+Aadhaar files.
router.post(
  '/manual-kyc',
  upload.fields([
    { name: 'pan', maxCount: 1 },
    { name: 'aadhaar_front', maxCount: 1 },
    { name: 'aadhaar_back', maxCount: 1 },
  ]),
  onboardingController.submitManualKyc
);

// Step 2: Face match — compare uploaded selfie with DigiLocker / KYC photo
router.post('/face-verify', upload.single('photo'), onboardingController.verifyFaceMatch);

// Step 3: Bank details (account + IFSC), runs fuzzy name match against PAN/full_name
router.post('/bank', onboardingController.saveBank);

// Step 4: Cancelled cheque (optional — can skip)
router.post('/cheque', upload.single('cheque'), onboardingController.saveCheque);
router.post('/cheque/skip', onboardingController.skipCheque);

// Step 5: Address (permanent + current)
router.post('/address', onboardingController.saveAddress);

// Step 6: Mark complete
router.post('/complete', onboardingController.complete);

// Tour
router.post('/tour-complete', onboardingController.markTourComplete);

module.exports = router;
