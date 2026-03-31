const { Notification } = require('../models');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const filter = { user_id: req.user._id || req.user.id };
    if (unread === 'true') filter.is_read = false;
    const total = await Notification.countDocuments(filter);
    const rows = await Notification.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, data: { notifications: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id || req.user.id },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) { next(err); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user_id: req.user._id || req.user.id, is_read: false },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user._id || req.user.id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
};

// Create notification for a specific user (admin use)
exports.sendNotification = async (req, res, next) => {
  try {
    const { user_id, title, message, type = 'general', data } = req.body;
    if (!user_id || !title || !message) {
      return res.status(400).json({ success: false, message: 'user_id, title, message required' });
    }
    const notification = await Notification.create({ user_id, title, message, type, data, sent_at: new Date() });
    res.status(201).json({ success: true, data: notification });
  } catch (err) { next(err); }
};

// Create notification for all users (admin broadcast)
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, type = 'general', data } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title, message required' });
    }
    const User = require('../models').User;
    const users = await User.find({ role: 'member', is_active: true }).select('_id');
    const docs = users.map(u => ({ user_id: u._id, title, message, type, data, sent_at: new Date() }));
    await Notification.insertMany(docs);
    res.status(201).json({ success: true, message: `Notification sent to ${docs.length} users` });
  } catch (err) { next(err); }
};

// Get unread count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user_id: req.user._id || req.user.id, is_read: false });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
};
