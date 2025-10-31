const Message = require("../../models/chats/MessageSchema");
const Friend = require("../../models/FriendRequestSchema");
const Chat = require("../../models/chats/ChatSchema");

// This function is now handled by socket events instead of API calls
// const sendMessage = async (req, res) => {
//   try {
//     const { chatId, senderId, receiverId, content, type } = req.body;
//     if (!chatId || !senderId || !receiverId || !content || !type) {
//       return res.status(400).json({ message: "All fields are required" });
//     }
//     const isFriend = await Friend.findOne({
//       $or: [
//         { sender: senderId, receiver: receiverId },
//         { sender: receiverId, receiver: senderId },
//       ],
//       status: "accepted",
//     });

//     if (!isFriend) {
//       return res.status(400).json({ message: "Not friends" });
//     }

//     const existingChat = await Chat.findOne({
//       members: { $all: [senderId, receiverId] },
//     });

//     if (!existingChat) {
//       const newChat = await Chat.create({ members: [senderId, receiverId] });
//       chatId = newChat._id;
//     }

//     const newMessage = await Message.create({
//       chatId,
//       sender: senderId,
//       receiver: receiverId,
//       content,
//       type,
//     });
//     await newMessage.populate("sender receiver", "username profileImage");

//     await Chat.findByIdAndUpdate(chatId, {
//       $set: {
//         lastMessage: newMessage._id,
//         lastMessageTime: new Date(),
//       },
//       $inc: {
//         [`unreadCount.${receiverId}`]: 1,
//       },
//     });
//     const io = req.app.get("io");
//     if (io) {
//       io.to(`user-${receiverId}`).emit("new-message", newMessage);
//     }
//     res.status(201).json({
//       success: true,
//       message: newMessage,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 10, before } = req.query;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query for pagination
    let query = { chatId };

    // If 'before' parameter is provided, get messages before that timestamp
    if (before) {
      // query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender receiver", "username profileImage")
      .sort({ createdAt: -1 }) // Latest messages first
      .skip(skip)
      .limit(limitNum);

    const totalMessages = await Message.countDocuments({ chatId });
    const totalPages = Math.ceil(totalMessages / limitNum);
    const hasMore = pageNum < totalPages;

    console.log(
      `✅ Get Messages API successful for chatId: ${chatId} - returned ${messages.length} messages`
    );

    res.status(200).json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore,
      currentPage: pageNum,
      totalPages,
      totalMessages,
      nextCursor:
        messages.length > 0 ? messages[messages.length - 1].createdAt : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateMessageStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;
    if (!messageId || !status) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const message = await Message.findByIdAndUpdate(messageId, {
      $set: { status },
    });

    if (!message) {
      return res.status(400).json({ message: "Message not found" });
    }

    // await Chat.findByIdAndUpdate(message.chatId, {
    //   $set: {
    //     lastMessage: message._id,
    //     lastMessageTime: new Date(),
    //   },
    // });

    console.log(
      `✅ Update Message Status API successful for messageId: ${messageId}`
    );

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  // sendMessage, // Commented out since we're using sockets now
  getMessages,
  updateMessageStatus,
};
