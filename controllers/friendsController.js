const Friends = require("../models/FriendRequestSchema");
const NotificationService = require("../services/notificationService");
const User = require("../models/UserSchema");

const getFriendList = async (req, res) => {
  try {
    const { limit = 10, page = 1, search = "" } = req.query;
    const userId = req.user.userId;

    const skip = (page - 1) * limit;

    // First, find all friends without search filter
    let friendList = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    })
      .populate("sender receiver", "-password -email")
      .skip(skip)
      .limit(parseInt(limit));

    // If search is provided, filter the results
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search, "i");
      friendList = friendList.filter((friendship) => {
        const sender = friendship.sender;
        const receiver = friendship.receiver;

        // Check if search matches sender or receiver
        const senderMatch =
          (sender.nickname && searchRegex.test(sender.nickname)) ||
          (sender.username && searchRegex.test(sender.username)) ||
          (sender.firstName && searchRegex.test(sender.firstName)) ||
          (sender.lastName && searchRegex.test(sender.lastName));

        const receiverMatch =
          (receiver.nickname && searchRegex.test(receiver.nickname)) ||
          (receiver.username && searchRegex.test(receiver.username)) ||
          (receiver.firstName && searchRegex.test(receiver.firstName)) ||
          (receiver.lastName && searchRegex.test(receiver.lastName));

        return senderMatch || receiverMatch;
      });
    }

    // Process the friend list to return the correct user info and status
    const processedFriendList = friendList.map((friendship) => {
      // If I'm the sender, show the receiver; if I'm the receiver, show the sender
      const isCurrentUserSender = friendship.sender._id.toString() === userId;

      return {
        ...(isCurrentUserSender
          ? friendship.receiver.toObject()
          : friendship.sender.toObject()),
        status: friendship.status,
        isMutualFriend: false, // For current user's friends, this is always false
      };
    });

    // For total count, we need to get all friends and then filter if search is provided
    let allFriends = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    }).populate("sender receiver", "-password -email");

    // If search is provided, filter the results for count
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search, "i");
      allFriends = allFriends.filter((friendship) => {
        const sender = friendship.sender;
        const receiver = friendship.receiver;

        // Check if search matches sender or receiver
        const senderMatch =
          (sender.nickname && searchRegex.test(sender.nickname)) ||
          (sender.username && searchRegex.test(sender.username)) ||
          (sender.firstName && searchRegex.test(sender.firstName)) ||
          (sender.lastName && searchRegex.test(sender.lastName));

        const receiverMatch =
          (receiver.nickname && searchRegex.test(receiver.nickname)) ||
          (receiver.username && searchRegex.test(receiver.username)) ||
          (receiver.firstName && searchRegex.test(receiver.firstName)) ||
          (receiver.lastName && searchRegex.test(receiver.lastName));

        return senderMatch || receiverMatch;
      });
    }

    const total = allFriends.length;
    res.json({
      friendList: processedFriendList,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: processedFriendList.length === parseInt(limit),
    });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const getBlockedFriendList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const blockedFriendList = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "blocked",
    }).populate("sender receiver", "-password -email");

    const blockedUsersList = [];

    blockedFriendList.forEach((friend) => {
      if (friend.sender._id.toString() === userId) {
        blockedUsersList.push(friend.receiver);
      } else {
        blockedUsersList.push(friend.sender);
      }
    });

    res.json({ blockedUsersList });
  } catch (error) {
    console.log("Error in fetching blocked friend list", error);
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
      return res.status(400).json({ error: "Friendship request already sent" });
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
      const user = await User.findById(friendId);
      if (user?.settings?.getFriendInvites) {
        await NotificationService.createFriendRequestNotification(
          userId,
          friendId,
          friend._id
        );
      }
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

    res.status(200).json({
      message: "Friend removed successfully",
      friendId: id,
      success: true,
    });
  } catch (error) {
    console.log("Error in fetching friend list", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const blockProfile = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "friendId is required" });
    }
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: "friendId is required" });
    }
    const userId = req.user.userId;

    const friend = await Friends.findOneAndUpdate(
      {
        $or: [
          { sender: userId, receiver: friendId },
          { sender: friendId, receiver: userId },
        ],
      },
      { status: "blocked" },
      { new: true }
    );

    if (!friend) {
      const newFriend = await Friends.create({
        sender: userId,
        receiver: friendId,
        status: "blocked",
      });
      if (!newFriend) {
        return res.status(400).json({ error: "Error blocking profile" });
      }
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
      const Notification = require("../models/NotificationSchema");
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
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const skip = (page - 1) * limit;

    // Get the other user's friend list with pagination
    const otherUserFriends = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    })
      .populate("sender receiver", "-password -email")
      .skip(skip)
      .limit(parseInt(limit));

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

    // Process the friend list to return the correct user info and status
    const friendsWithMutualStatus = otherUserFriends.map((friendship) => {
      // If the target user is the sender, show the receiver; if the target user is the receiver, show the sender
      const isTargetUserSender = friendship.sender._id.toString() === userId;
      const friendUser = isTargetUserSender
        ? friendship.receiver
        : friendship.sender;
      const friendId = friendUser._id.toString();

      const isMutualFriend = currentUserFriendIds.has(friendId);

      return {
        ...friendUser.toObject(),
        status: friendship.status,
        isMutualFriend,
        mutualFriendStatus: isMutualFriend ? "mutual" : "not_mutual",
      };
    });

    // Get total count for pagination
    const total = await Friends.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    });

    res.json({
      success: true,
      friends: friendsWithMutualStatus,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: friendsWithMutualStatus.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting other user's friend list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getFriendList,
  getBlockedFriendList,
  addFriend,
  removeFriend,
  blockProfile,
  acceptFriendRequest,
  rejectFriendRequest,
  getOtherUserFriendList,
};
