// models/PostLike.js
const mongoose = require("mongoose");

const MeetHotlistSchema = new mongoose.Schema({
  meetId: { type: mongoose.Schema.Types.ObjectId, ref: "Meet" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index for better query performance
MeetHotlistSchema.index({ meetId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("MeetHotlist", MeetHotlistSchema);
