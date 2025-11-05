const mongoose = require("mongoose");

const profileViewSchema = new mongoose.Schema(
  {
    profileOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
profileViewSchema.index({ profileOwner: 1, viewedAt: -1 });
profileViewSchema.index({ profileOwner: 1, viewer: 1 });

const ProfileView = mongoose.model("ProfileView", profileViewSchema);

module.exports = ProfileView;
