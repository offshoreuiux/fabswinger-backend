const mongoose = require("mongoose");

const postCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ForumPost",
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
      ref: "ForumPostComment",
      default: null, // null for top-level comments, ObjectId for replies
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ForumPostComment", postCommentSchema);
