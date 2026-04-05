const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, JPEG and PNG images are allowed'));
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

// Support tickets — user-facing endpoints
const SupportTicket = require('../models/SupportTicket');

// Family Members CRUD
const familyMemberController = require('../controllers/familyMemberController');
router.get('/family-members', familyMemberController.list);
router.post('/family-members', familyMemberController.create);
router.put('/family-members/:id', familyMemberController.update);
router.delete('/family-members/:id', familyMemberController.remove);

router.post('/support', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { subject, description, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }
    const ticket = await SupportTicket.create({
      user_id: userId,
      subject,
      description,
      priority: priority || 'medium',
    });
    res.json({ success: true, message: 'Support ticket created', data: ticket });
  } catch (err) { next(err); }
});

router.get('/support/tickets', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const tickets = await SupportTicket.find({ user_id: userId }).sort({ created_at: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) { next(err); }
});

router.get('/support/tickets/:id', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user_id: userId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) { next(err); }
});

// Admin only routes
router.get('/', authorizeRoles('admin', 'super_admin'), userController.getAllUsers);
router.get('/:id', authorizeRoles('admin', 'super_admin'), userController.getUserById);
router.put('/:id', authorizeRoles('admin', 'super_admin'), userController.updateUser);
router.delete('/:id', authorizeRoles('super_admin'), userController.deleteUser);

module.exports = router;
