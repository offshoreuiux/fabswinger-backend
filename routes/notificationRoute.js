const express = require("express");
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  getFilterCounts,
} = require("../controllers/notificationController");
const { authenticateToken } = require("../middleware");

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

// Get user notifications with pagination
router.get("/", getUserNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadCount);

// Get notification filter counts
router.get("/filter-counts", getFilterCounts);

// Mark specific notification as read
router.put("/:notificationId/read", markNotificationAsRead);

// Mark all notifications as read
router.put("/mark-all-read", markAllNotificationsAsRead);

// Delete notification
router.delete("/:notificationId", deleteNotification);

module.exports = router;
