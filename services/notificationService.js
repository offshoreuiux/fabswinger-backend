const Notification = require("../models/NotificationModel");
const User = require("../models/UserModel");
const { emitNotification, emitUnreadCountUpdate } = require("../utils/socket");

class NotificationService {
  // Create a new notification
  static async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();

      // Populate sender info for immediate use
      await notification.populate("sender", "nickname profileImage");

      // Emit real-time notification to recipient
      try {
        emitNotification(notificationData.recipient, notification);

        // Update unread count for recipient
        const unreadCount = await this.getUnreadCount(
          notificationData.recipient
        );
        emitUnreadCountUpdate(notificationData.recipient, unreadCount);
      } catch (socketError) {
        console.error("Socket emission error:", socketError);
        // Don't fail the notification creation if socket fails
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Create friend request notification
  static async createFriendRequestNotification(
    senderId,
    recipientId,
    friendRequestId
  ) {
    try {
      const sender = await User.findById(senderId).select(
        "nickname profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      const notificationData = {
        recipient: recipientId,
        sender: senderId,
        type: "friend_request",
        title: "New Friend Request",
        message: `<span class="text-sm font-semibold capitalize">${sender.nickname}</span> sent you a friend request`,
        relatedItem: friendRequestId,
        relatedItemModel: "FriendRequest",
        metadata: {
          action: "view_profile",
          profileId: senderId,
          friendRequestId: friendRequestId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating friend request notification:", error);
      throw error;
    }
  }

  // Create friend request accepted notification
  static async createFriendRequestAcceptedNotification(
    accepterId,
    requesterId
  ) {
    try {
      const accepter = await User.findById(accepterId).select(
        "nickname profileImage"
      );
      if (!accepter) throw new Error("Accepter not found");

      const notificationData = {
        recipient: requesterId,
        sender: accepterId,
        type: "friend_request_accepted",
        title: "Friend Request Accepted",
        message: `<span class="text-sm font-semibold capitalize">${accepter.nickname}</span> accepted your friend request`,
        relatedItem: accepterId,
        relatedItemModel: "User",
        metadata: {
          action: "view_profile",
          profileId: accepterId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating friend request accepted notification:",
        error
      );
      throw error;
    }
  }

  // Create friend request rejected notification
  static async createFriendRequestRejectedNotification(
    rejecterId,
    requesterId
  ) {
    try {
      const rejecter = await User.findById(rejecterId).select(
        "nickname profileImage"
      );
      if (!rejecter) throw new Error("Rejecter not found");

      const notificationData = {
        recipient: requesterId,
        sender: rejecterId,
        type: "friend_request_rejected",
        title: "Friend Request Declined",
        message: `<span class="text-sm font-semibold capitalize">${rejecter.nickname}</span> declined your friend request`,
        relatedItem: rejecterId,
        relatedItemModel: "User",
        metadata: {
          action: "view_profile",
          profileId: rejecterId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating friend request rejected notification:",
        error
      );
      throw error;
    }
  }

  // Create post like notification
  static async createPostLikeNotification(likerId, postOwnerId, postId) {
    try {
      if (likerId.toString() === postOwnerId.toString()) {
        return null; // Don't notify if user likes their own post
      }

      const liker = await User.findById(likerId).select(
        "nickname profileImage"
      );
      if (!liker) throw new Error("Liker not found");

      const notificationData = {
        recipient: postOwnerId,
        sender: likerId,
        type: "post_like",
        title: "New Like",
        message: `<span class="text-sm font-semibold capitalize">${liker.nickname}</span> liked your post`,
        relatedItem: postId,
        relatedItemModel: "Post",
        metadata: {
          action: "view_post",
          postId: postId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating post like notification:", error);
      throw error;
    }
  }

  // Create post comment notification
  static async createPostCommentNotification(
    commenterId,
    postOwnerId,
    postId,
    commentText
  ) {
    try {
      if (commenterId.toString() === postOwnerId.toString()) {
        return null; // Don't notify if user comments on their own post
      }

      const commenter = await User.findById(commenterId).select(
        "nickname profileImage"
      );
      if (!commenter) throw new Error("Commenter not found");

      const truncatedComment =
        commentText.length > 50
          ? commentText.substring(0, 50) + "..."
          : commentText;

      const notificationData = {
        recipient: postOwnerId,
        sender: commenterId,
        type: "post_comment",
        title: "New Comment",
        message: `<span class="text-sm font-semibold capitalize">${commenter.nickname}</span> commented: "${truncatedComment}"`,
        relatedItem: postId,
        relatedItemModel: "Post",
        metadata: {
          action: "view_post",
          postId: postId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating post comment notification:", error);
      throw error;
    }
  }

  // Create profile view notification
  static async createProfileViewNotification(viewerId, profileOwnerId) {
    try {
      if (viewerId.toString() === profileOwnerId.toString()) {
        return null; // Don't notify if user views their own profile
      }

      const viewer = await User.findById(viewerId).select(
        "nickname profileImage"
      );
      if (!viewer) throw new Error("Viewer not found");

      const notificationData = {
        recipient: profileOwnerId,
        sender: viewerId,
        type: "profile_view",
        title: "Profile Viewed",
        message: `<span class="text-sm font-semibold capitalize">${viewer.nickname}</span> viewed your profile`,
        relatedItem: viewerId,
        relatedItemModel: "User",
        metadata: {
          action: "view_profile",
          profileId: viewerId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating profile view notification:", error);
      throw error;
    }
  }

  // Update notification type
  static async updateNotificationType(
    notificationId,
    newType,
    additionalData = {}
  ) {
    try {
      const updateData = { type: newType, ...additionalData };
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        updateData,
        { new: true }
      ).populate("sender", "nickname profileImage");

      if (!notification) {
        throw new Error("Notification not found");
      }

      return notification;
    } catch (error) {
      console.error("Error updating notification type:", error);
      throw error;
    }
  }

  // Update friend request notification to accepted/rejected
  static async updateFriendRequestNotificationStatus(
    notificationId,
    newStatus,
    senderId
  ) {
    try {
      const sender = await User.findById(senderId).select(
        "nickname profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      let updateData = {};

      if (newStatus === "accepted") {
        updateData = {
          type: "accepted",
          title: "Friend Request Accepted",
          message: `You accepted <span class="text-sm font-semibold capitalize">${sender.nickname}</span> as your friend`,
        };
      } else if (newStatus === "rejected") {
        updateData = {
          type: "rejected",
          title: "Friend Request Declined",
          message: `You declined <span class="text-sm font-semibold capitalize">${sender.nickname}</span> as your friend`,
        };
      }

      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        updateData,
        { new: true }
      ).populate("sender", "nickname profileImage");

      if (!notification) {
        throw new Error("Notification not found");
      }

      // Emit real-time update for the notification type change
      try {
        const { emitNotificationTypeChange } = require("../utils/socket");
        emitNotificationTypeChange(
          notification.recipient,
          notificationId,
          newStatus,
          notification
        );
      } catch (socketError) {
        console.error("Socket emission error:", socketError);
        // Don't fail the notification update if socket fails
      }

      return notification;
    } catch (error) {
      console.error(
        "Error updating friend request notification status:",
        error
      );
      throw error;
    }
  }

  // Get user notifications
  static async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({
        recipient: userId,
        isDeleted: false,
      })
        .populate("sender", "nickname profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({
        recipient: userId,
        isDeleted: false,
      });

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Error getting user notifications:", error);
      throw error;
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId,
        },
        { isRead: true },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  // Mark multiple notifications as read
  static async markNotificationsAsRead(notificationIds, userId) {
    try {
      const result = await Notification.updateMany(
        {
          _id: { $in: notificationIds },
          recipient: userId,
          isRead: false,
        },
        { isRead: true }
      );

      return result;
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          isRead: false,
          isDeleted: false,
        },
        { isRead: true }
      );

      return result;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId,
        },
        { isDeleted: true },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  // Get unread notification count
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        isDeleted: false,
      });

      return count;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  }
}

module.exports = NotificationService;
