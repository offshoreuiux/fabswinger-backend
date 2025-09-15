// models/PostLike.js
const mongoose = require("mongoose");

const ProfileHotlistSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index for better query performance
ProfileHotlistSchema.index({ profileId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("ProfileHotlist", ProfileHotlistSchema);
