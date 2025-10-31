const Chat = require("../../models/chats/ChatSchema");
const Message = require("../../models/chats/MessageSchema");
const Friend = require("../../models/FriendRequestSchema");
const SubscriptionSchema = require("../../models/payment/SubscriptionSchema");

const createChat = async (req, res) => {
  try {
    const {
      senderId,
      receiverId,
      type = "private",
      name,
      description,
      memberIds,
    } = req.body;

    if (type === "private") {
      // Private chat logic (existing)
      if (!senderId || !receiverId) {
        return res
          .status(400)
          .json({ message: "Sender and receiver IDs are required" });
      }

      const isFriend = await Friend.findOne({
        $or: [
          { sender: senderId, receiver: receiverId },
          { sender: receiverId, receiver: senderId },
        ],
        status: "accepted",
      });

      if (!isFriend) {
        return res.status(400).json({ message: "Not friends" });
      }

      const existingChat = await Chat.findOne({
        members: { $all: [senderId, receiverId] },
        type: "private",
      });

      if (existingChat) {
        return res.status(200).json(existingChat);
      }

      const newChat = await Chat.create({
        members: [senderId, receiverId],
        type: "private",
      });
      res.status(201).json(newChat);
    } else if (type === "group") {
      // Group chat logic
      if (
        !name ||
        !memberIds ||
        !Array.isArray(memberIds) ||
        memberIds.length < 1
      ) {
        return res.status(400).json({
          message: "Group name and at least 2 members are required",
        });
      }

      // Add the creator to the members list if not already included
      const allMembers = [...new Set([senderId, ...memberIds])];

      if (allMembers.length < 2) {
        return res.status(400).json({
          message: "Group must have at least 2 members",
        });
      }

      // Check if ALL members have active subscriptions
      const subscriptions = await SubscriptionSchema.find({
        userId: { $in: allMembers.map((member) => member.toString()) },
        status: "active",
      });
      console.log("subscriptions:", subscriptions);

      // Verify that every member has an active subscription
      const membersWithSubscription = subscriptions.map((sub) =>
        sub.userId.toString()
      );
      const allMembersHaveSubscription = allMembers.every((memberId) =>
        membersWithSubscription.includes(memberId.toString())
      );

      if (!allMembersHaveSubscription) {
        return res.status(400).json({
          message:
            "All members must have an active subscription to create a group chat",
        });
      }

      const newChat = await Chat.create({
        members: allMembers,
        type: "group",
        name,
        description: description || "",
        admin: senderId,
      });

      await newChat.populate("members", "username profileImage");
      await newChat.populate("admin", "username profileImage");

      res.status(201).json({ chat: newChat, success: true });
    } else {
      return res.status(400).json({ message: "Invalid chat type" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getChats = async (req, res) => {
  try {
    const { search = "", type = "all" } = req.query;
    const userId = req.user.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    let chats;

    if (type === "Unread") {
      chats = await Chat.find({
        members: { $in: [userId] },
        [`unreadCount.${userId}`]: { $gt: 0 },
      })
        .populate("members", "username profileImage")
        .populate("lastMessage", "content createdAt")
        .sort({ lastMessageTime: -1 });
    } else if (type === "Read") {
      chats = await Chat.find({
        members: { $in: [userId] },
        $or: [
          { [`unreadCount.${userId}`]: { $eq: 0 } },
          { [`unreadCount.${userId}`]: { $exists: false } },
        ],
      })
        .populate("members", "username profileImage")
        .populate("lastMessage", "content createdAt")
        .sort({ lastMessageTime: -1 });
    } else {
      chats = await Chat.find({
        members: { $in: [userId] },
      })
        .populate("members", "username profileImage")
        .populate("lastMessage", "content createdAt")
        .sort({ lastMessageTime: -1 });
    }

    if (!chats || chats.length === 0) {
      return res.status(404).json({ message: "No chats found", chats: [] });
    }

    // Filter chats by search term if provided
    if (search.trim()) {
      chats = chats.filter((chat) => {
        return chat.members.some((member) => {
          if (member._id.toString() === userId) return false; // Skip current user
          return (
            member.username?.toLowerCase().includes(search.toLowerCase()) ||
            member.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            member.lastName?.toLowerCase().includes(search.toLowerCase())
          );
        });
      });
    }

    // Get delivered message counts for each chat
    const chatsWithDeliveredInfo = await Promise.all(
      chats.map(async (chat) => {
        const chatObject = chat.toObject();

        if (chat.type === "private") {
          const otherMembers = chatObject.members.filter(
            (member) => member._id.toString() !== userId
          );

          return {
            ...chatObject,
            members: otherMembers[0],
            unreadCount: chat.unreadCount.get(userId) || 0,
          };
        } else {
          // Group chat
          return {
            ...chatObject,
            unreadCount: chat.unreadCount.get(userId) || 0,
          };
        }
      })
    );

    const unreadCount = await Chat.find({
      members: { $in: [userId] },
      [`unreadCount.${userId}`]: { $gt: 0 },
    })
      .populate("members", "username profileImage")
      .populate("lastMessage", "content createdAt")
      .sort({ lastMessageTime: -1 });

    res.status(200).json({
      chats: chatsWithDeliveredInfo,
      unreadCount: unreadCount?.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!chatId || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    chat.unreadCount.set(userId, 0);
    await chat.save();
    await Message.updateMany(
      { chatId, receiver: userId },
      { $set: { isRead: true }, $set: { status: "read" } }
    );
    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!chatId || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    await Message.deleteMany({ chatId });
    chat.unreadCount.set(userId, 0);
    chat.lastMessage = null;
    chat.lastMessageTime = null;
    await chat.save();
    res.status(200).json(chat);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!chatId || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (chat.admin.toString() === userId) {
      return res
        .status(400)
        .json({ message: "You are the admin of this group, you cannot leave" });
    }
    chat.members = chat.members.filter(
      (member) => member.toString() !== userId
    );
    await chat.save();
    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId, name, description, members } = req.body;
    if (!chatId || !userId || !name || !description || !members) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    chat.name = name;
    chat.description = description;
    chat.members = members;
    await chat.save();
    const result = await chat.populate("members", "username profileImage");
    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!chatId || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (chat.admin.toString() !== userId) {
      return res
        .status(400)
        .json({ message: "You are not the admin of this group" });
    }
    await chat.deleteOne();
    res.status(200).json({ message: "Group deleted successfully", chat });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createChat,
  getChats,
  markAsRead,
  clearChat,
  leaveGroup,
  updateGroup,
  deleteGroup,
};
