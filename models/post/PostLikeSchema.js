// models/PostLike.js
const mongoose = require("mongoose");

const PostLikeSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index for better query performance
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PostLike", PostLikeSchema);
