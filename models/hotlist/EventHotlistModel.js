// models/PostLike.js
const mongoose = require("mongoose");

const EventHotlistSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index for better query performance
EventHotlistSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("EventHotlist", EventHotlistSchema);
