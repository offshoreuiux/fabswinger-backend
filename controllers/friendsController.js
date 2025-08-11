const Friends = require("../models/FriendRequestSchema");
const NotificationService = require("../services/notificationService");

const getFriendList = async (req, res) => {
  try {
    const userId = req.user.userId;

    const friendList = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    }).populate("sender receiver", "-password -email");

    res.json({ friendList });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const addFriend = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "friendId is required" });
    }
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: "friendId is required" });
    }
    const userId = req.user.userId;

    if (friendId === userId) {
      return res.status(400).json({ error: "Cannot send request to yourself" });
    }

    const existing = await Friends.findOne({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId },
      ],
    });

    if (existing) {
      return res
        .status(400)
        .json({ error: "Friendship or request already exists" });
    }

    const friend = await Friends.create({
      sender: userId,
      receiver: friendId,
      status: "pending",
    });

    if (!friend) {
      return res.status(400).json({ error: "Error adding friend" });
    }

    // Create notification for the recipient
    try {
      await NotificationService.createFriendRequestNotification(
        userId,
        friendId,
        friend._id
      );
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({ message: "Friend request sent successfully" });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const removeFriend = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "id is required" });
    }
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const userId = req.user.userId;

    const friend = await Friends.findOneAndDelete({
      $or: [
        { receiver: id, sender: userId },
        { sender: id, receiver: userId },
      ],
    });

    if (!friend) {
      return res.status(400).json({ error: "Friendship not found" });
    }

    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const blockProfile = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "id is required" });
    }
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    const userId = req.user.userId;

    const friend = await Friends.findOneAndUpdate(
      { _id: id, $or: [{ sender: userId }, { receiver: userId }] },
      { status: "blocked" },
      { new: true }
    );

    if (!friend) {
      return res.status(400).json({ error: "Friendship not found" });
    }

    res.status(200).json({ message: "Profile blocked successfully" });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const acceptFriendRequest = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "id is required" });
    }
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: "id is required" });
    }
    const userId = req.user.userId;

    const friend = await Friends.findOneAndUpdate(
      {
        $or: [
          { sender: userId, receiver: friendId, status: "pending" },
          { sender: friendId, receiver: userId, status: "pending" },
        ],
      },
      { status: "accepted" },
      { new: true }
    );

    if (!friend) {
      return res.status(400).json({ error: "Friendship not found" });
    }

    // Find and update the original friend request notification
    try {
      const Notification = require("../models/NotificationModel");
      const originalNotification = await Notification.findOne({
        type: "friend_request",
        sender: friendId,
        recipient: userId,
      });

      if (originalNotification) {
        await NotificationService.updateFriendRequestNotificationStatus(
          originalNotification._id,
          "accepted",
          friendId
        );
      }
    } catch (notificationError) {
      console.error("Error updating notification:", notificationError);
      // Don't fail the request if notification update fails
    }

    // Create notification for the person who sent the request
    try {
      await NotificationService.createFriendRequestAcceptedNotification(
        userId,
        friendId
      );
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({ message: "Friend request accepted successfully" });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const rejectFriendRequest = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "id is required" });
    }
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: "id is required" });
    }
    const userId = req.user.userId;

    const friend = await Friends.findOneAndDelete({
      $or: [
        { sender: userId, receiver: friendId, status: "pending" },
        { sender: friendId, receiver: userId, status: "pending" },
      ],
    });

    if (!friend) {
      return res.status(400).json({ error: "Friendship not found" });
    }

    // Find and update the original friend request notification
    try {
      const Notification = require("../models/NotificationModel");
      const originalNotification = await Notification.findOne({
        type: "friend_request",
        sender: friendId,
        recipient: userId,
      });

      if (originalNotification) {
        await NotificationService.updateFriendRequestNotificationStatus(
          originalNotification._id,
          "rejected",
          userId
        );
      }
    } catch (notificationError) {
      console.error("Error updating notification:", notificationError);
      // Don't fail the request if notification update fails
    }

    // Create notification for the person who sent the request
    try {
      await NotificationService.createFriendRequestRejectedNotification(
        userId,
        friendId
      );
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({ message: "Friend request rejected successfully" });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

// Get friend list of another user with mutual friend status
const getOtherUserFriendList = async (req, res) => {
  try {
    const { userId } = req.params; // The user whose friends we want to see
    const currentUserId = req.user.userId; // The logged-in user

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get the other user's friend list
    const otherUserFriends = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    }).populate("sender receiver", "-password -email");

    // Get current user's friend list for comparison
    const currentUserFriends = await Friends.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      status: { $nin: ["rejected", "blocked"] },
    });

    // Create a set of current user's friend IDs for quick lookup
    const currentUserFriendIds = new Set();
    currentUserFriends.forEach((friend) => {
      if (friend.sender.toString() === currentUserId) {
        currentUserFriendIds.add(friend.receiver.toString());
      } else {
        currentUserFriendIds.add(friend.sender.toString());
      }
    });

    // Add mutual friend status to each friend
    const friendsWithMutualStatus = otherUserFriends.map((friend) => {
      const friendId =
        friend.sender.toString() === userId
          ? friend.receiver._id.toString()
          : friend.sender._id.toString();

      const isMutualFriend = currentUserFriendIds.has(friendId);

      return {
        ...friend.toObject(),
        isMutualFriend,
        mutualFriendStatus: isMutualFriend ? "mutual" : "not_mutual",
      };
    });

    res.json({
      success: true,
      friends: friendsWithMutualStatus,
      total: friendsWithMutualStatus.length,
    });
  } catch (error) {
    console.error("Error getting other user's friend list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getFriendList,
  addFriend,
  removeFriend,
  blockProfile,
  acceptFriendRequest,
  rejectFriendRequest,
  getOtherUserFriendList,
};
