const Chat = require("../../models/chats/ChatSchema");
const Message = require("../../models/chats/MessageSchema");
const Friend = require("../../models/FriendRequestSchema");

const createChat = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
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
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    const newChat = await Chat.create({ members: [senderId, receiverId] });
    res.status(201).json(newChat);
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

        const otherMembers = chatObject.members.filter(
          (member) => member._id.toString() !== userId
        );

        return {
          ...chatObject,
          members: otherMembers[0],
          unreadCount: chat.unreadCount.get(userId) || 0,
        };
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

module.exports = {
  createChat,
  getChats,
  markAsRead,
};
