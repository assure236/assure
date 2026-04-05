const { FamilyMember } = require('../models');

// GET /api/v1/users/family-members
exports.list = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const members = await FamilyMember.find({ user_id: userId, is_active: true })
      .sort({ created_at: -1 });
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};

// POST /api/v1/users/family-members
exports.create = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { full_name, relationship, mobile, email, date_of_birth, gender, aadhaar_number, pan_number, is_nominee } = req.body;

    if (!full_name || !relationship) {
      return res.status(400).json({ success: false, message: 'Name and relationship are required' });
    }

    const count = await FamilyMember.countDocuments({ user_id: userId, is_active: true });
    if (count >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 family members allowed' });
    }

    // If marking as nominee, unmark previous nominee
    if (is_nominee) {
      await FamilyMember.updateMany({ user_id: userId }, { is_nominee: false });
    }

    const member = await FamilyMember.create({
      user_id: userId,
      full_name, relationship, mobile, email, date_of_birth, gender,
      aadhaar_number, pan_number, is_nominee: !!is_nominee,
    });

    res.status(201).json({ success: true, message: 'Family member added', data: member });
  } catch (err) { next(err); }
};

// PUT /api/v1/users/family-members/:id
exports.update = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { full_name, relationship, mobile, email, date_of_birth, gender, aadhaar_number, pan_number, is_nominee } = req.body;

    const member = await FamilyMember.findOne({ _id: req.params.id, user_id: userId, is_active: true });
    if (!member) return res.status(404).json({ success: false, message: 'Family member not found' });

    if (is_nominee) {
      await FamilyMember.updateMany({ user_id: userId, _id: { $ne: member._id } }, { is_nominee: false });
    }

    Object.assign(member, {
      ...(full_name !== undefined && { full_name }),
      ...(relationship !== undefined && { relationship }),
      ...(mobile !== undefined && { mobile }),
      ...(email !== undefined && { email }),
      ...(date_of_birth !== undefined && { date_of_birth }),
      ...(gender !== undefined && { gender }),
      ...(aadhaar_number !== undefined && { aadhaar_number }),
      ...(pan_number !== undefined && { pan_number }),
      ...(is_nominee !== undefined && { is_nominee }),
    });
    await member.save();

    res.json({ success: true, message: 'Family member updated', data: member });
  } catch (err) { next(err); }
};

// DELETE /api/v1/users/family-members/:id
exports.remove = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const member = await FamilyMember.findOneAndUpdate(
      { _id: req.params.id, user_id: userId, is_active: true },
      { is_active: false },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Family member not found' });
    res.json({ success: true, message: 'Family member removed' });
  } catch (err) { next(err); }
};

// ADMIN: GET /api/v1/admin/users/:id/family-members
exports.adminList = async (req, res, next) => {
  try {
    const members = await FamilyMember.find({ user_id: req.params.id, is_active: true })
      .sort({ created_at: -1 });
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};
