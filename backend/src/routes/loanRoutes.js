const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRoles } = require('../middleware/auth');
const Loan = require('../models/Loan');
const { ChitMember } = require('../models');

// All routes require authentication
router.use(authMiddleware);

// ─── User Routes ─────────────────────────────────────────────────────────────

// @route   POST /api/v1/loans/apply
// @desc    Apply for a loan
router.post('/apply', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { loan_type, requested_amount, tenure_months, chit_group_id, purpose } = req.body;

    if (!requested_amount || !tenure_months) {
      return res.status(400).json({ success: false, message: 'Amount and tenure are required' });
    }

    if (requested_amount < 1000) {
      return res.status(400).json({ success: false, message: 'Minimum loan amount is ₹1,000' });
    }

    if (tenure_months < 1 || tenure_months > 60) {
      return res.status(400).json({ success: false, message: 'Tenure must be between 1 and 60 months' });
    }

    // Check for existing active loan
    const activeLoan = await Loan.findOne({ 
      user_id: userId, 
      status: { $in: ['requested', 'under_review', 'approved', 'disbursed', 'active'] } 
    });
    if (activeLoan) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an active loan application. Please wait for it to be processed.' 
      });
    }

    // For chit loans, verify membership
    if (loan_type === 'chit_loan' && chit_group_id) {
      const membership = await ChitMember.findOne({ user_id: userId, chit_group_id });
      if (!membership) {
        return res.status(400).json({ success: false, message: 'You are not a member of this chit group' });
      }
    }

    const loan = await Loan.create({
      user_id: userId,
      loan_type: loan_type || 'personal_loan',
      requested_amount,
      tenure_months,
      chit_group_id: chit_group_id || undefined,
      purpose: purpose || '',
      outstanding_amount: requested_amount,
    });

    res.status(201).json({ success: true, message: 'Loan application submitted', data: loan });
  } catch (err) { next(err); }
});

// @route   GET /api/v1/loans/my-loans
// @desc    Get user's loans
router.get('/my-loans', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const loans = await Loan.find({ user_id: userId })
      .populate('chit_group_id', 'group_name chit_value')
      .sort({ created_at: -1 });
    res.json({ success: true, data: loans });
  } catch (err) { next(err); }
});

// @route   GET /api/v1/loans/:id
// @desc    Get single loan details
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const loan = await Loan.findOne({ _id: req.params.id, user_id: userId })
      .populate('chit_group_id', 'group_name chit_value')
      .populate('reviewed_by', 'full_name')
      .populate('approved_by', 'full_name');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (err) { next(err); }
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

// @route   GET /api/v1/loans/admin/all
// @desc    Get all loans (admin)
router.get('/admin/all', authorizeRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const total = await Loan.countDocuments(filter);
    const loans = await Loan.find(filter)
      .populate('user_id', 'full_name mobile member_id')
      .populate('chit_group_id', 'group_name chit_value')
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: loans, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// @route   GET /api/v1/loans/admin/stats
// @desc    Loan statistics
router.get('/admin/stats', authorizeRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const [total, pending, active, disbursed, closed, rejected] = await Promise.all([
      Loan.countDocuments(),
      Loan.countDocuments({ status: { $in: ['requested', 'under_review'] } }),
      Loan.countDocuments({ status: { $in: ['active', 'disbursed'] } }),
      Loan.aggregate([{ $match: { status: { $in: ['disbursed', 'active'] } } }, { $group: { _id: null, total: { $sum: '$approved_amount' } } }]),
      Loan.countDocuments({ status: 'closed' }),
      Loan.countDocuments({ status: 'rejected' }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        pending,
        active,
        total_disbursed: disbursed[0]?.total || 0,
        closed,
        rejected,
      }
    });
  } catch (err) { next(err); }
});

// @route   PUT /api/v1/loans/admin/:id/review
// @desc    Review/approve/reject a loan
router.put('/admin/:id/review', authorizeRoles('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { action, approved_amount, interest_rate, admin_notes, rejection_reason } = req.body;
    const adminId = req.user._id || req.user.id;
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    switch (action) {
      case 'approve':
        loan.status = 'approved';
        loan.approved_amount = approved_amount || loan.requested_amount;
        loan.interest_rate = interest_rate || loan.interest_rate;
        loan.approved_by = adminId;
        loan.approved_at = new Date();
        loan.outstanding_amount = loan.approved_amount;
        // EMI will be calculated by pre-save hook
        loan.emi_amount = undefined;
        break;

      case 'reject':
        loan.status = 'rejected';
        loan.rejection_reason = rejection_reason || 'Application rejected';
        break;

      case 'disburse':
        if (loan.status !== 'approved') {
          return res.status(400).json({ success: false, message: 'Loan must be approved before disbursement' });
        }
        loan.status = 'disbursed';
        loan.disbursed_at = new Date();
        // Set first EMI date to 30 days from now
        const emiDate = new Date();
        emiDate.setDate(emiDate.getDate() + 30);
        loan.next_emi_date = emiDate;
        break;

      case 'close':
        loan.status = 'closed';
        loan.closed_at = new Date();
        loan.outstanding_amount = 0;
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid action. Use: approve, reject, disburse, close' });
    }

    loan.reviewed_by = adminId;
    loan.reviewed_at = new Date();
    if (admin_notes) loan.admin_notes = admin_notes;

    await loan.save();
    res.json({ success: true, message: `Loan ${action}d successfully`, data: loan });
  } catch (err) { next(err); }
});

module.exports = router;
