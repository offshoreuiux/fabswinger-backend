// models/PostLike.js
const mongoose = require("mongoose");

const MeetingHotlistSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index for better query performance
MeetingHotlistSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("MeetingHotlist", MeetingHotlistSchema);
