const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_request_accepted",
        "friend_request_rejected",
        "post_like",
        "forum_like",
        "post_comment",
        "post_wink",
        "post_reply",
        "profile_view",
        "message",
        "event_invite",
        "hotlist_add",
        "verification_approved",
        "verification_rejected",
        "event_application",
        "event_application_accepted",
        "event_application_rejected",
        "event_participant_removed",
        "meet_application",
        "meet_joined",
        "meet_join_confirmation",
        "meet_application_accepted",
        "meet_application_rejected",
        "meet_participant_removed",
        "forum_comment",
        "profile_wink",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedItem: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedItemModel",
    },
    relatedItemModel: {
      type: String,
      enum: [
        "User",
        "Post",
        "Event",
        "Meet",
        "FriendRequest",
        "ForumPost",
        "Wink",
      ],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isDeleted: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
