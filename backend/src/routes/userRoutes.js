const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');
const { Goal } = require('../models');

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

// ── Profile field change routes ───────────────────────────────────────────────
const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, PDF allowed'));
  }
});

router.post('/profile/change-email/send-otp', userController.changeEmailSendOtp);
router.post('/profile/change-email/verify-otp', userController.changeEmailVerifyOtp);
router.post('/profile/nominee-otp/send', userController.nomineeOtpSend);
router.put('/profile/change-address', uploadProof.single('address_proof'), userController.changeAddress);
router.put('/profile/change-bank', uploadProof.single('bank_proof'), userController.changeBankDetails);
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/v1/users/bank/ifsc/:ifsc
// @desc    Lookup bank/branch details by IFSC
// @access  Private
router.get('/bank/ifsc/:ifsc', userController.lookupIfsc);

// @route   POST /api/v1/users/bank/verify-account
// @desc    Verify bank account holder details with account number + IFSC
// @access  Private
router.post('/bank/verify-account', userController.verifyBankAccount);

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

// ── Goals CRUD ────────────────────────────────────────────────────────────────
router.get('/goals', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const goals = await Goal.find({ user_id: userId }).sort({ created_at: -1 });
    res.json({ success: true, data: goals });
  } catch (err) { next(err); }
});

router.post('/goals', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, category, target_amount, target_date } = req.body;
    if (!name || !target_amount) {
      return res.status(400).json({ success: false, message: 'name and target_amount are required' });
    }
    const goal = await Goal.create({
      user_id: userId,
      name,
      category: category || 'Savings',
      target_amount: Number(target_amount),
      target_date: target_date ? new Date(target_date) : undefined,
    });
    res.status(201).json({ success: true, message: 'Goal created', data: goal });
  } catch (err) { next(err); }
});

router.put('/goals/:id', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { current_amount, name, target_amount, target_date, is_completed } = req.body;
    const update = {};
    if (current_amount !== undefined) update.current_amount = Number(current_amount);
    if (name !== undefined) update.name = name;
    if (target_amount !== undefined) update.target_amount = Number(target_amount);
    if (target_date !== undefined) update.target_date = new Date(target_date);
    if (is_completed !== undefined) {
      update.is_completed = is_completed;
      if (is_completed) update.completed_at = new Date();
    }
    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, user_id: userId }, update, { new: true });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
});

router.delete('/goals/:id', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user_id: userId });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) { next(err); }
});

router.post('/support', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { subject, description, priority, category } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }
    const ticket = await SupportTicket.create({
      user_id: userId,
      subject,
      description,
      priority: priority || 'medium',
      category: category || 'General',
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

// Agent request routes
router.post('/agent-request', userController.submitAgentRequest);
router.get('/agent-request', userController.getMyAgentRequest);

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

// Profile edit lock — admin approval/rejection
router.post('/:user_id/approve-profile-edit', authorizeRoles('admin', 'super_admin'), userController.approveProfileEdit);
router.post('/:user_id/reject-profile-edit', authorizeRoles('admin', 'super_admin'), userController.rejectProfileEdit);

module.exports = router;
