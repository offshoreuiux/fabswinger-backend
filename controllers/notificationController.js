const NotificationService = require("../services/notificationService");
const {
  emitNotificationUpdate,
  emitUnreadCountUpdate,
} = require("../utils/socket");

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const result = await NotificationService.getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    // Automatically mark fetched notifications as read
    if (result.notifications.length > 0) {
      const notificationIds = result.notifications.map((n) => n._id);
      await NotificationService.markNotificationsAsRead(
        notificationIds,
        userId
      );

      // Emit real-time update for unread count
      try {
        const { emitUnreadCountUpdate } = require("../utils/socket");
        const unreadCount = await NotificationService.getUnreadCount(userId);
        emitUnreadCountUpdate(userId, unreadCount);
      } catch (socketError) {
        console.error("Socket emission error:", socketError);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await NotificationService.markNotificationAsRead(
      notificationId,
      userId
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Emit real-time update
    try {
      emitNotificationUpdate(userId, "mark-read", {
        notificationId,
        isRead: true,
      });

      // Update unread count
      const unreadCount = await NotificationService.getUnreadCount(userId);
      emitUnreadCountUpdate(userId, unreadCount);
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
    }

    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await NotificationService.markAllNotificationsAsRead(userId);

    // Emit real-time update
    try {
      emitNotificationUpdate(userId, "mark-all-read", {
        modifiedCount: result.modifiedCount,
      });

      // Update unread count
      emitUnreadCountUpdate(userId, 0);
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
    }

    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await NotificationService.deleteNotification(
      notificationId,
      userId
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Emit real-time update
    try {
      emitNotificationUpdate(userId, "delete", { notificationId });

      // Update unread count
      const unreadCount = await NotificationService.getUnreadCount(userId);
      emitUnreadCountUpdate(userId, unreadCount);
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const count = await NotificationService.getUnreadCount(userId);

    res.json({ unreadCount: count });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
};
