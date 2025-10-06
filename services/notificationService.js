const Notification = require("../models/NotificationSchema");
const User = require("../models/UserSchema");
const Comment = require("../models/forum/PostCommentSchema");

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
        const {
          emitNotification,
          emitUnreadCountUpdate,
        } = require("../utils/socket");
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

  // Create private message notification
  static async createPrivateMessageNotification(
    senderId,
    recipientId,
    chatId,
    messageText
  ) {
    try {
      if (senderId.toString() === recipientId.toString()) {
        return null;
      }

      const sender = await User.findById(senderId).select(
        "nickname username profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      const truncated = (messageText || "").toString().trim();
      const preview =
        truncated.length > 80 ? truncated.substring(0, 80) + "..." : truncated;

      const notificationData = {
        recipient: recipientId,
        sender: senderId,
        type: "message",
        title: "New Message",
        message: `<span class="text-sm font-semibold capitalize">${
          sender.nickname || sender.username
        }</span>, sent you a message: ${preview}`,
        // Linkable context kept in metadata since relatedItemModel doesn't include Chat/Message
        relatedItem: senderId,
        relatedItemModel: "User",
        metadata: {
          action: "view_chat",
          chatId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating private message notification:", error);
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
        "nickname username profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      const notificationData = {
        recipient: recipientId,
        sender: senderId,
        type: "friend_request",
        title: "New Friend Request",
        message: `<span class="text-sm font-semibold capitalize">${
          sender.nickname || sender.username
        }</span> sent you a friend request`,
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
        "nickname username profileImage"
      );
      if (!accepter) throw new Error("Accepter not found");

      const notificationData = {
        recipient: requesterId,
        sender: accepterId,
        type: "friend_request_accepted",
        title: "Friend Request Accepted",
        message: `<span class="text-sm font-semibold capitalize">${
          accepter.nickname || accepter.username
        }</span> accepted your friend request`,
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
        "nickname username profileImage"
      );
      if (!rejecter) throw new Error("Rejecter not found");

      const notificationData = {
        recipient: requesterId,
        sender: rejecterId,
        type: "friend_request_rejected",
        title: "Friend Request Declined",
        message: `<span class="text-sm font-semibold capitalize">${
          rejecter.nickname || rejecter.username
        }</span> declined your friend request`,
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
        "nickname username profileImage"
      );
      if (!liker) throw new Error("Liker not found");

      const notificationData = {
        recipient: postOwnerId,
        sender: likerId,
        type: "post_like",
        title: "New Like",
        message: `<span class="text-sm font-semibold capitalize">${
          liker.nickname || liker.username
        }</span> liked your post`,
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

  // Create forumn like notification
  static async createForumLikeNotification(likerId, postOwnerId, postId) {
    try {
      if (likerId.toString() === postOwnerId.toString()) {
        return null; // Don't notify if user likes their own post
      }

      const liker = await User.findById(likerId).select(
        "nickname username profileImage"
      );
      if (!liker) throw new Error("Liker not found");

      const notificationData = {
        recipient: postOwnerId,
        sender: likerId,
        type: "forum_like",
        title: "New Like",
        message: `<span class="text-sm font-semibold capitalize">${
          liker.nickname || liker.username
        }</span> liked your forum post`,
        relatedItem: postId,
        relatedItemModel: "ForumPost",
        metadata: {
          action: "view_forum_post",
          forumId: postId,
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
        "nickname username profileImage"
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
        message: `<span class="text-sm font-semibold capitalize">${
          commenter.nickname || commenter.username
        }</span> commented: "${truncatedComment}"`,
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
        "nickname username  profileImage"
      );
      if (!viewer) throw new Error("Viewer not found");

      const notificationData = {
        recipient: profileOwnerId,
        sender: viewerId,
        type: "profile_view",
        title: "Profile Viewed",
        message: `<span class="text-sm font-semibold capitalize">${
          viewer.nickname || viewer.username
        }</span> viewed your profile`,
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
          message: `You accepted <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> as your friend`,
        };
      } else if (newStatus === "rejected") {
        updateData = {
          type: "rejected",
          title: "Friend Request Declined",
          message: `You declined <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> as your friend`,
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

  // Create event application notification
  static async createEventApplicationNotification(
    eventCreatorId,
    applicantId,
    eventId,
    eventTitle
  ) {
    try {
      const applicant = await User.findById(applicantId).select(
        "nickname username profileImage"
      );
      if (!applicant) throw new Error("Applicant not found");

      const notificationData = {
        recipient: eventCreatorId,
        sender: applicantId,
        type: "event_application",
        title: "New Event Application",
        message: `<span class="text-sm font-semibold capitalize">${
          applicant.nickname || applicant.username
        }</span> applied to join your event "${eventTitle}"`,
        relatedItem: eventId,
        relatedItemModel: "Event",
        metadata: {
          action: "view_event",
          eventId: eventId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating event application notification:", error);
      throw error;
    }
  }

  // Create event application accepted notification
  static async createEventApplicationAcceptedNotification(
    eventCreatorId,
    applicantId,
    eventId,
    eventTitle
  ) {
    try {
      const eventCreator = await User.findById(eventCreatorId).select(
        "nickname username profileImage"
      );
      if (!eventCreator) throw new Error("Event creator not found");

      const notificationData = {
        recipient: applicantId,
        sender: eventCreatorId,
        type: "event_application_accepted",
        title: "Event Application Accepted",
        message: `<span class="text-sm font-semibold capitalize">${
          eventCreator.nickname || eventCreator.username
        }</span> accepted your application to join their event "${eventTitle}"`,
        relatedItem: eventId,
        relatedItemModel: "Event",
        metadata: {
          action: "view_event",
          eventId: eventId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating event application accepted notification:",
        error
      );
      throw error;
    }
  }

  // Create event application rejected notification
  static async createEventApplicationRejectedNotification(
    eventCreatorId,
    applicantId,
    eventId,
    eventTitle
  ) {
    try {
      const eventCreator = await User.findById(eventCreatorId).select(
        "nickname username profileImage"
      );
      if (!eventCreator) throw new Error("Event creator not found");

      const notificationData = {
        recipient: applicantId,
        sender: eventCreatorId,
        type: "event_application_rejected",
        title: "Event Application Rejected",
        message: `<span class="text-sm font-semibold capitalize">${
          eventCreator.nickname || eventCreator.username
        }</span> rejected your application to join their event "${eventTitle}"`,
        relatedItem: eventId,
        relatedItemModel: "Event",
        metadata: {
          action: "view_event",
          eventId: eventId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating event application rejected notification:",
        error
      );
      throw error;
    }
  }

  static async updateEventApplicationNotificationStatus(
    notificationId,
    newStatus,
    senderId,
    eventTitle
  ) {
    try {
      const sender = await User.findById(senderId).select(
        "nickname username profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      let updateData = {};

      if (newStatus === "approved") {
        updateData = {
          type: "accepted",
          title: "Request to join event Accepted",
          message: `You accepted <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> to join your event "${eventTitle}"`,
        };
      } else if (newStatus === "rejected") {
        updateData = {
          type: "rejected",
          title: "Request to join event Declined",
          message: `You declined <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> to join your event "${eventTitle}"`,
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

  static async createMeetApplicationNotification(
    meetCreatorId,
    applicantId,
    meetId,
    meetTitle
  ) {
    try {
      const meetCreator = await User.findById(meetCreatorId).select(
        "nickname username profileImage"
      );
      if (!meetCreator) throw new Error("Meet creator not found");

      const notificationData = {
        recipient: meetCreatorId,
        sender: applicantId,
        type: "meet_application",
        title: "New Meet Application",
        message: `<span class="text-sm font-semibold capitalize">${
          meetCreator.nickname || meetCreator.username
        }</span> applied to join your meet "${meetTitle}"`,
        relatedItem: meetId,
        relatedItemModel: "Meet",
        metadata: {
          action: "view_meet",
          meetId: meetId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating meet application notification:", error);
      throw error;
    }
  }

  static async createMeetApplicationAcceptedNotification(
    meetCreatorId,
    applicantId,
    meetId,
    meetTitle
  ) {
    try {
      const meetCreator = await User.findById(meetCreatorId).select(
        "nickname username profileImage"
      );
      if (!meetCreator) throw new Error("Meet creator not found");

      const notificationData = {
        recipient: applicantId,
        sender: meetCreatorId,
        type: "meet_application_accepted",
        title: "Meet Application Accepted",
        message: `<span class="text-sm font-semibold capitalize">${
          meetCreator.nickname || meetCreator.username
        }</span> accepted your application to join their meet "${meetTitle}"`,
        relatedItem: meetId,
        relatedItemModel: "Meet",
        metadata: {
          action: "view_meet",
          meetId: meetId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating meet application accepted notification:",
        error
      );
      throw error;
    }
  }

  // Create event application rejected notification
  static async createMeetApplicationRejectedNotification(
    meetCreatorId,
    applicantId,
    meetId,
    meetTitle
  ) {
    try {
      const meetCreator = await User.findById(meetCreatorId).select(
        "nickname username profileImage"
      );
      if (!meetCreator) throw new Error("Meet creator not found");

      const notificationData = {
        recipient: applicantId,
        sender: meetCreatorId,
        type: "meet_application_rejected",
        title: "Meet Application Rejected",
        message: `<span class="text-sm font-semibold capitalize">${
          meetCreator.nickname || meetCreator.username
        }</span> rejected your application to join their meet "${meetTitle}"`,
        relatedItem: meetId,
        relatedItemModel: "Meet",
        metadata: {
          action: "view_meet",
          meetId: meetId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating meet application rejected notification:",
        error
      );
      throw error;
    }
  }

  static async createMeetJoinedNotification(
    meetCreatorId,
    applicantId,
    meetId,
    meetTitle
  ) {
    try {
      const applicant = await User.findById(applicantId).select(
        "nickname username profileImage"
      );
      if (!applicant) throw new Error("Applicant not found");

      const notificationData = {
        recipient: meetCreatorId,
        sender: applicantId,
        type: "meet_joined",
        title: "Meet Joined",
        message: `<span class="text-sm font-semibold capitalize">${
          applicant.nickname || applicant.username
        }</span> joined your meet "${meetTitle}"`,
        relatedItem: meetId,
        relatedItemModel: "Meet",
        metadata: {
          action: "view_meet",
          meetId: meetId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating meet joined notification:", error);
      throw error;
    }
  }

  static async createMeetJoinConfirmationNotification(
    meetCreatorId,
    applicantId,
    meetId,
    meetTitle
  ) {
    try {
      const meetCreator = await User.findById(meetCreatorId).select(
        "nickname username profileImage"
      );
      if (!meetCreator) throw new Error("Meet creator not found");

      const notificationData = {
        recipient: applicantId,
        sender: meetCreatorId,
        type: "meet_join_confirmation",
        title: "Successfully Joined Meet",
        message: `You have successfully joined <span class="text-sm font-semibold capitalize">${
          meetCreator.nickname || meetCreator.username
        }</span>'s meet "${meetTitle}"`,
        relatedItem: meetId,
        relatedItemModel: "Meet",
        metadata: {
          action: "view_meet",
          meetId: meetId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error(
        "Error creating meet join confirmation notification:",
        error
      );
      throw error;
    }
  }

  static async updateMeetApplicationNotificationStatus(
    notificationId,
    newStatus,
    senderId,
    meetTitle
  ) {
    try {
      const sender = await User.findById(senderId).select(
        "nickname username profileImage"
      );
      if (!sender) throw new Error("Sender not found");

      let updateData = {};

      if (newStatus === "approved") {
        updateData = {
          type: "accepted",
          title: "Request to join meet Accepted",
          message: `You accepted <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> to join your meet "${meetTitle}"`,
        };
      } else if (newStatus === "rejected") {
        updateData = {
          type: "rejected",
          title: "Request to join meet Declined",
          message: `You declined <span class="text-sm font-semibold capitalize">${
            sender.nickname || sender.username
          }</span> to join your meet "${meetTitle}"`,
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
        "Error updating meet application notification status:",
        error
      );
      throw error;
    }
  }

  static async createForumCommentNotification(
    commenterId,
    postOwnerId,
    postId,
    parentCommentId
  ) {
    try {
      const commenter = await User.findById(commenterId).select(
        "nickname username profileImage"
      );
      if (!commenter) throw new Error("Commenter not found");
      let comment = null;
      if (parentCommentId) {
        comment = await Comment.findById(parentCommentId).populate(
          "userId",
          "nickname username profileImage"
        );
      }

      const notificationData = {
        recipient: comment?.userId?._id || comment?.userId?.id || postOwnerId,
        sender: commenterId,
        type: "forum_comment",
        title: "New Comment",
        message: `<span class="text-sm font-semibold capitalize">${
          commenter.nickname || commenter.username
        }</span> ${
          parentCommentId
            ? "replied to your comment"
            : "commented on your forum post"
        }`,
        relatedItem: postId,
        relatedItemModel: "ForumPost",
        metadata: {
          action: "view_forum_post",
          forumId: postId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating forum comment notification:", error);
      throw error;
    }
  }

  static async createProfileWinkNotification(winkerId, profileOwnerId) {
    try {
      const winker = await User.findById(winkerId).select(
        "nickname username profileImage"
      );
      if (!winker) throw new Error("Winker not found");

      const notificationData = {
        recipient: profileOwnerId,
        sender: winkerId,
        type: "profile_wink",
        title: "New Wink",
        message: `<span class="text-sm font-semibold capitalize">${
          winker.nickname || winker.username
        }</span> winked your profile`,
        relatedItem: profileOwnerId,
        relatedItemModel: "User",
        metadata: {
          action: "view_profile",
          profileId: profileOwnerId,
        },
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error("Error creating profile wink notification:", error);
      throw error;
    }
  }

  // Get user notifications
  static async getUserNotifications(
    userId,
    page = 1,
    limit = 20,
    filter = null
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build query based on filter
      const query = {
        recipient: userId,
        isDeleted: false,
      };

      // Add type filter if specified
      if (filter && filter !== "All") {
        const typeFilter = this.getNotificationTypesForFilter(filter);
        if (typeFilter && typeFilter.length > 0) {
          query.type = { $in: typeFilter };
        }
      }

      const notifications = await Notification.find(query)
        .populate("sender", "nickname profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Error getting user notifications:", error);
      throw error;
    }
  }

  // Get notification types for a specific filter
  static getNotificationTypesForFilter(filter) {
    const filterMap = {
      "Friend Requests": [
        "friend_request",
        "friend_request_accepted",
        "friend_request_rejected",
      ],
      Winks: ["profile_wink"],
      Events: [
        "event_invite",
        "event_application",
        "event_application_accepted",
        "event_application_rejected",
        "event_participant_removed",
      ],
      Meets: [
        "meet_application",
        "meet_joined",
        "meet_join_confirmation",
        "meet_application_accepted",
        "meet_application_rejected",
        "meet_participant_removed",
      ],
      Clubs: ["hotlist_add", "verification_approved", "verification_rejected"],
      Posts: [
        "post_like",
        "forum_like",
        "post_comment",
        "post_reply",
        "forum_comment",
      ],
      Messages: ["message", "profile_view"],
    };

    return filterMap[filter] || [];
  }

  // Get filter counts for all notification types
  static async getFilterCounts(userId) {
    try {
      const baseQuery = {
        recipient: userId,
        isDeleted: false,
      };

      const filters = [
        "All",
        "Friend Requests",
        "Winks",
        "Events",
        "Meets",
        "Clubs",
        "Posts",
        "Messages",
      ];

      const counts = {};

      for (const filter of filters) {
        if (filter === "All") {
          counts[filter] = await Notification.countDocuments(baseQuery);
        } else {
          const typeFilter = this.getNotificationTypesForFilter(filter);
          if (typeFilter && typeFilter.length > 0) {
            counts[filter] = await Notification.countDocuments({
              ...baseQuery,
              type: { $in: typeFilter },
            });
          } else {
            counts[filter] = 0;
          }
        }
      }

      return counts;
    } catch (error) {
      console.error("Error getting filter counts:", error);
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
