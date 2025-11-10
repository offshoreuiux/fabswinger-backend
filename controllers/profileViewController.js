const SubscriptionSchema = require("../models/payment/SubscriptionSchema");
const ProfileView = require("../models/ProfileViewSchema");
const User = require("../models/user/UserSchema");
const NotificationService = require("../services/notificationService");
const mongoose = require("mongoose");

// Track a profile view
const trackProfileView = async (req, res) => {
  try {
    const { profileId } = req.params;
    const viewerId = req.user.userId;

    console.log("Track Profile View Request:");
    console.log("- profileId:", profileId);
    console.log("- viewerId:", viewerId);
    console.log("- req.user:", req.user);

    // Validate profile ID
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    // Don't track if viewing own profile
    if (profileId === viewerId) {
      return res.status(200).json({ message: "Own profile view not tracked" });
    }

    // Check if profile owner exists
    const profileOwner = await User.findById(profileId);
    if (!profileOwner) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const user = await User.findById(viewerId).select("settings");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.settings.whosLookedAtMe) {
      return;
    }

    // Create profile view record
    const profileView = new ProfileView({
      profileOwner: profileId,
      viewer: viewerId,
      viewedAt: new Date(),
    });

    const savedView = await profileView.save();
    console.log("- Profile view saved:", savedView);

    // Verify the record was saved
    const verifyView = await ProfileView.findById(savedView._id);
    console.log("- Verified saved view:", verifyView);

    // Count total views for this profile
    const totalViews = await ProfileView.countDocuments({
      profileOwner: profileId,
    });
    console.log("- Total views for this profile:", totalViews);

    // Create/update notification for profile owner
    await NotificationService.handleProfileViewNotification(
      profileId,
      viewerId
    );

    return res.status(200).json({
      success: true,
      message: "Profile view tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking profile view:", error);
    return res.status(500).json({
      message: "Error tracking profile view",
      error: error.message,
    });
  }
};

// Get profile viewers for the current week
const getProfileViewers = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log("Get Profile Viewers Request:");
    console.log("- userId:", userId);

    // Get user with subscription info
    const user = await User.findById(userId).select("subscription");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check subscription status
    const hasActiveSubscription = await SubscriptionSchema.findOne({ userId });
    console.log(
      "- hasActiveSubscription:",
      hasActiveSubscription?.status === "active"
    );

    // Get start and end of current week (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    console.log("- Week range:", startOfWeek, "to", endOfWeek);

    // Get unique viewers for this week
    const viewers = await ProfileView.aggregate([
      {
        $match: {
          profileOwner: new mongoose.Types.ObjectId(userId),
          viewedAt: { $gte: startOfWeek, $lte: endOfWeek },
          viewer: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude self
        },
      },
      {
        $sort: { viewedAt: -1 },
      },
      {
        $group: {
          _id: "$viewer",
          lastViewed: { $first: "$viewedAt" },
          viewCount: { $sum: 1 },
        },
      },
      {
        $sort: { lastViewed: -1 },
      },
    ]);

    const totalViewers = viewers.length;
    console.log("- totalViewers:", totalViewers);
    console.log("- viewers sample:", viewers.slice(0, 3));

    // Populate viewer details
    const viewerIds = viewers.map((v) => v._id);
    const viewerDetails = await User.find({
      _id: { $in: viewerIds },
    }).select(
      "nickname username profileImage subscription isVerified gender lookingFor age sexuality"
    );

    // Get friendship status for each viewer
    const FriendRequest = require("../models/FriendRequestSchema");
    const friendRequests = await FriendRequest.find({
      $or: [
        { sender: userId, receiver: { $in: viewerIds } },
        { sender: { $in: viewerIds }, receiver: userId },
      ],
    }).lean();
    console.log("- friendRequests:", friendRequests);

    // Map viewer details with view info and friendship status
    let viewersWithDetails = viewers.map((v) => {
      const userDetail = viewerDetails.find(
        (u) => u._id.toString() === v._id.toString()
      );

      // Determine friendship status
      let friendshipStatus = "none";
      const friendRequest = friendRequests.find(
        (fr) =>
          (fr.sender.toString() === userId.toString() &&
            fr.receiver.toString() === v._id.toString()) ||
          (fr.sender.toString() === v._id.toString() &&
            fr.receiver.toString() === userId.toString())
      );
      console.log("- friendRequest:", friendRequest);

      if (friendRequest) {
        if (friendRequest.status === "accepted") {
          friendshipStatus = "friends";
        } else if (friendRequest.status === "pending") {
          friendshipStatus = "pending";
        }
      }

      return {
        user: {
          ...userDetail.toObject(),
          friendshipStatus,
        },
        lastViewed: v.lastViewed,
        viewCount: v.viewCount,
      };
    });

    // Limit to first 3 if no active subscription
    if (!hasActiveSubscription) {
      viewersWithDetails = viewersWithDetails.slice(0, 3);
    }

    return res.status(200).json({
      success: true,
      hasActiveSubscription,
      totalViewers,
      viewersShown: viewersWithDetails.length,
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      viewers: viewersWithDetails,
      message:
        !hasActiveSubscription && totalViewers > 3
          ? "Subscribe to see all profile viewers"
          : undefined,
    });
  } catch (error) {
    console.error("Error getting profile viewers:", error);
    return res.status(500).json({
      message: "Error getting profile viewers",
      error: error.message,
    });
  }
};

// Get profile view statistics
const getProfileViewStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get start and end of current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get stats for this week
    const weekStats = await ProfileView.aggregate([
      {
        $match: {
          profileOwner: new mongoose.Types.ObjectId(userId),
          viewedAt: { $gte: startOfWeek, $lte: endOfWeek },
          viewer: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id: "$viewer",
        },
      },
      {
        $count: "uniqueViewers",
      },
    ]);

    // Get total all-time views
    const totalViews = await ProfileView.countDocuments({
      profileOwner: userId,
      viewer: { $ne: userId },
    });

    // Get total unique viewers all-time
    const allTimeStats = await ProfileView.aggregate([
      {
        $match: {
          profileOwner: new mongoose.Types.ObjectId(userId),
          viewer: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id: "$viewer",
        },
      },
      {
        $count: "uniqueViewers",
      },
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        thisWeek: {
          uniqueViewers: weekStats[0]?.uniqueViewers || 0,
          weekStart: startOfWeek,
          weekEnd: endOfWeek,
        },
        allTime: {
          totalViews,
          uniqueViewers: allTimeStats[0]?.uniqueViewers || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error getting profile view stats:", error);
    return res.status(500).json({
      message: "Error getting profile view stats",
      error: error.message,
    });
  }
};

module.exports = {
  trackProfileView,
  getProfileViewers,
  getProfileViewStats,
};
