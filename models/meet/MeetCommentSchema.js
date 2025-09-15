const mongoose = require("mongoose");

const meetCommentSchema = new mongoose.Schema(
  {
    meetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meet",
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
meetCommentSchema.index({ meetId: 1, createdAt: -1 });
meetCommentSchema.index({ parentCommentId: 1, createdAt: 1 });
meetCommentSchema.index({ userId: 1, createdAt: -1 });

// Virtual for reply count
meetCommentSchema.virtual("replyCount", {
  ref: "MeetComment",
  localField: "_id",
  foreignField: "parentCommentId",
  count: true,
});

// Ensure virtuals are included when converting to JSON
meetCommentSchema.set("toJSON", { virtuals: true });
meetCommentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("MeetComment", meetCommentSchema);
