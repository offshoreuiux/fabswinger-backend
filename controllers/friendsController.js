const Friends = require("../models/FriendRequestSchema");
const NotificationService = require("../services/notificationService");
const User = require("../models/user/UserSchema");
const SubscriptionSchema = require("../models/payment/SubscriptionSchema");
const Notification = require("../models/NotificationSchema");
const { sendMail } = require("../utils/transporter");
const { generateFriendRequestEmail } = require("../utils/emailTemplates");

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
      .populate("sender receiver", "-password")
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
    const processedFriendList = friendList
      ?.map((friendship) => {
        // If I'm the sender, show the receiver; if I'm the receiver, show the sender
        const isCurrentUserSender =
          friendship?.sender?._id.toString() === userId;

        const friendUser = isCurrentUserSender
          ? friendship?.receiver
          : friendship?.sender;

        // Filter out users with hidden profiles
        if (
          friendUser?.settings?.profileVisibility === false &&
          friendUser?._id.toString() !== userId
        ) {
          return null;
        }

        return {
          ...(friendUser?.toObject() || {}),
          status: friendship?.status,
          isMutualFriend: false, // For current user's friends, this is always false
        };
      })
      .filter((friend) => friend !== null); // Remove null entries

    // For total count, we need to get all friends and then filter if search is provided
    let allFriends = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    }).populate("sender receiver", "-password");

    // Filter out hidden profiles from allFriends
    allFriends = allFriends.filter((friendship) => {
      const isCurrentUserSender = friendship?.sender?._id.toString() === userId;
      const friendUser = isCurrentUserSender
        ? friendship?.receiver
        : friendship?.sender;

      // Exclude hidden profiles
      if (
        friendUser?.settings?.profileVisibility === false &&
        friendUser?._id.toString() !== userId
      ) {
        return false;
      }
      return true;
    });

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
    console.log(
      `✅ Get Friend List API successful for userId: ${userId} - returned ${processedFriendList.length} friends`
    );
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

    console.log(
      `✅ Get Blocked Friend List API successful for userId: ${userId} - returned ${blockedUsersList.length} blocked users`
    );

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

    const friendRequestSentCount = await Friends.countDocuments({
      sender: userId,
      status: { $nin: ["blocked"] },
    });

    const subscription = await SubscriptionSchema.findOne({
      userId: userId,
    });

    if (!subscription || subscription.status !== "active") {
      if (friendRequestSentCount >= 30) {
        return res.status(400).json({
          error:
            "You have reached the limit of sending friend requests ,upgrade to gold supporter plan to add more friends",
        });
      }
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0); // today 00:00

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999); // today 23:59

      const friendRequestSentCountForToday = await Friends.countDocuments({
        sender: userId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ["blocked"] },
      });
      if (friendRequestSentCountForToday >= 3) {
        return res.status(400).json({
          error:
            "You have reached the limit of sending friend requests for today ,upgrade to gold supporter plan to add more friends",
        });
      }
    }

    const existing = await Friends.findOne({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId },
      ],
      status: { $nin: ["accepted", "rejected", "blocked"] },
    });

    if (existing) {
      return res.status(400).json({ error: "Friendship request already sent" });
    }

    const ifFriendReqRejected = await Friends.findOne({
      $or: [
        { sender: userId, receiver: friendId, status: "rejected" },
        { sender: friendId, receiver: userId, status: "rejected" },
      ],
    });
    if (ifFriendReqRejected) {
      ifFriendReqRejected.status = "pending";
      ifFriendReqRejected.createdAt = new Date();
      ifFriendReqRejected.updatedAt = new Date();
      ifFriendReqRejected.sender = userId;
      ifFriendReqRejected.receiver = friendId;
      await ifFriendReqRejected.save();

      try {
        const user = await User.findById(friendId);
        await NotificationService.createFriendRequestNotification(
          userId,
          friendId,
          ifFriendReqRejected._id
        );
        if (user?.settings?.getFriendInvites) {
          const mailOptions = {
            to: user.email,
            subject: "New Friend Request",
            html: generateFriendRequestEmail(userId, friendId),
            from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
          };
          await sendMail(mailOptions);
        }
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(200).json({
        message: "Friendship request re-sent successfully",
        friendRequest: ifFriendReqRejected,
        success: true,
      });
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
      await NotificationService.createFriendRequestNotification(
        userId,
        friendId,
        friend._id
      );
      if (user?.settings?.getFriendInvites) {
        const mailOptions = {
          to: user.email,
          subject: "New Friend Request",
          html: generateFriendRequestEmail(userId, friendId),
          from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
        };
        await sendMail(mailOptions);
      }
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the request if notification fails
    }

    console.log(
      `✅ Add Friend API successful - userId: ${userId} sent request to friendId: ${friendId}`
    );

    res.status(200).json({
      message: "Friend request sent successfully",
      friendRequest: friend,
      success: true,
    });
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

    if (friend.status === "pending") {
      const notification = await Notification.findOne({
        relatedItemModel: "FriendRequest",
        sender: userId,
        recipient: id,
        type: "friend_request",
      });
      if (notification) {
        await Notification.findOneAndDelete({
          relatedItemModel: "FriendRequest",
          sender: userId,
          recipient: id,
          type: "friend_request",
        });
      }
      console.log("notification deleted", userId, id, notification);
    }

    console.log(
      `✅ Remove Friend API successful for userId: ${userId} - removed friendId: ${id}`
    );

    res.status(200).json({
      message: "Friend removed successfully",
      friendId: id,
      success: true,
      friendRequest: friend,
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

    console.log(
      `✅ Block Profile API successful for userId: ${userId} - blocked friendId: ${friendId}`
    );

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
        console.log("originalNotification", originalNotification);
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

    console.log(
      `✅ Accept Friend Request API successful for userId: ${userId} - accepted friendId: ${friendId}`
    );

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

    const friend = await Friends.findOne({
      $or: [
        { sender: userId, receiver: friendId, status: "pending" },
        { sender: friendId, receiver: userId, status: "pending" },
      ],
    });

    if (!friend) {
      return res.status(400).json({ error: "Friendship not found" });
    }

    friend.status = "rejected";
    await friend.save();

    // Find and update the original friend request notification
    try {
      const Notification = require("../models/NotificationSchema");
      const originalNotification = await Notification.findOne({
        type: "friend_request",
        sender: friendId,
        recipient: userId,
      });

      if (originalNotification) {
        // await NotificationService.updateFriendRequestNotificationStatus(
        //   originalNotification._id,
        //   "rejected",
        //   userId
        // );
        await Notification.deleteOne({
          type: "friend_request",
          sender: friendId,
          recipient: userId,
        });
      }
    } catch (notificationError) {
      console.error("Error updating notification:", notificationError);
      // Don't fail the request if notification update fails
    }

    // Create notification for the person who sent the request
    // try {
    //   await NotificationService.createFriendRequestRejectedNotification(
    //     userId,
    //     friendId
    //   );
    // } catch (notificationError) {
    //   console.error("Error creating notification:", notificationError);
    //   // Don't fail the request if notification fails
    // }

    console.log(
      `✅ Reject Friend Request API successful for userId: ${userId} - rejected friendId: ${friendId}`
    );

    res.status(200).json({
      message: "Friend request rejected successfully",
      friendId: friendId,
      success: true,
    });
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
      .populate("sender receiver", "-password")
      .skip(skip)
      .limit(parseInt(limit));

    // Get current user's friend list for comparison
    const currentUserFriends = await Friends.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      status: { $nin: ["rejected", "blocked"] },
    });

    // Create a map of current user's friend IDs to their friendship status for quick lookup
    const currentUserFriendStatusByUserId = new Map();
    currentUserFriends.forEach((friendshipDoc) => {
      const otherUserId =
        friendshipDoc.sender.toString() === currentUserId
          ? friendshipDoc.receiver.toString()
          : friendshipDoc.sender.toString();
      currentUserFriendStatusByUserId.set(otherUserId, friendshipDoc.status);
    });

    // Process the friend list to return the correct user info and status
    const friendsWithMutualStatus = otherUserFriends
      .map((friendship) => {
        // If the target user is the sender, show the receiver; if the target user is the receiver, show the sender
        const isTargetUserSender = friendship.sender._id.toString() === userId;
        const friendUser = isTargetUserSender
          ? friendship.receiver
          : friendship.sender;
        const friendId = friendUser._id.toString();

        // Filter out users with hidden profiles (unless it's the current user viewing their own profile)
        if (
          friendUser?.settings?.profileVisibility === false &&
          friendId !== currentUserId
        ) {
          return null;
        }

        const mutualStatusWithCurrentUser =
          currentUserFriendStatusByUserId.get(friendId) || null;

        return {
          ...friendUser.toObject(),
          status: friendship.status,
          mutualFriendStatus: mutualStatusWithCurrentUser || "not_mutual",
        };
      })
      .filter((friend) => friend !== null); // Remove null entries

    // Get total count for pagination (need to filter hidden profiles)
    const allOtherUserFriends = await Friends.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $nin: ["rejected", "blocked"] },
    }).populate("sender receiver", "-password");

    // Filter out hidden profiles for accurate count
    const visibleFriends = allOtherUserFriends.filter((friendship) => {
      const isTargetUserSender = friendship.sender._id.toString() === userId;
      const friendUser = isTargetUserSender
        ? friendship.receiver
        : friendship.sender;
      const friendId = friendUser._id.toString();

      // Exclude hidden profiles
      if (
        friendUser?.settings?.profileVisibility === false &&
        friendId !== currentUserId
      ) {
        return false;
      }
      return true;
    });

    const total = visibleFriends.length;

    console.log(
      `✅ Get Other User Friend List API successful - userId: ${userId} viewed by currentUser: ${currentUserId}`
    );

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
