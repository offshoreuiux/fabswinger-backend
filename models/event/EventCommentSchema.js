const mongoose = require("mongoose");

const eventCommentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventComment",
      default: null, // null for top-level comments, ObjectId for replies
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
eventCommentSchema.index({ eventId: 1, createdAt: -1 });
eventCommentSchema.index({ parentCommentId: 1, createdAt: 1 });
eventCommentSchema.index({ userId: 1, createdAt: -1 });

// Virtual for reply count
eventCommentSchema.virtual("replyCount", {
  ref: "EventComment",
  localField: "_id",
  foreignField: "parentCommentId",
  count: true,
});

// Ensure virtuals are included when converting to JSON
eventCommentSchema.set("toJSON", { virtuals: true });
eventCommentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("EventComment", eventCommentSchema);
