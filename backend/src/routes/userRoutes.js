const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG and PNG images are allowed'));
  }
});

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/v1/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', userController.getProfile);

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', userController.updateProfile);

// @route   PUT /api/v1/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', userController.changePassword);

// @route   POST /api/v1/users/upload-profile-image
// @desc    Upload profile image
// @access  Private
router.post('/upload-profile-image', upload.single('image'), userController.uploadProfileImage);

// @route   GET /api/v1/users/my-chit-groups
// @desc    Get user's chit groups
// @access  Private
router.get('/my-chit-groups', userController.getMyChitGroups);

// @route   GET /api/v1/users/payment-history
// @desc    Get user's payment history
// @access  Private
router.get('/payment-history', userController.getPaymentHistory);

// @route   POST /api/v1/users/update-fcm-token
// @desc    Update FCM token for push notifications
// @access  Private
router.post('/update-fcm-token', userController.updateFcmToken);

// Support request (stub — email integration in Phase 4)
router.post('/support', async (req, res) => {
  res.json({ success: true, message: 'Support request received. We will respond within 24 hours.' });
});

// Admin only routes
router.get('/', authorizeRoles('admin', 'super_admin'), userController.getAllUsers);
router.get('/:id', authorizeRoles('admin', 'super_admin'), userController.getUserById);
router.put('/:id', authorizeRoles('admin', 'super_admin'), userController.updateUser);
router.delete('/:id', authorizeRoles('super_admin'), userController.deleteUser);

module.exports = router;
