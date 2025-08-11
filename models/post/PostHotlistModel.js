// models/PostHotList.js
const mongoose = require("mongoose");

const PostHotlistSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PostHotList", PostHotlistSchema);
