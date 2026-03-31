const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/mark-read', notificationController.markAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Admin routes
router.post('/send', authorizeRoles('admin', 'super_admin'), notificationController.sendNotification);
router.post('/broadcast', authorizeRoles('admin', 'super_admin'), notificationController.broadcastNotification);

module.exports = router;
