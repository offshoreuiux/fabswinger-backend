const { Server } = require("socket.io");
const User = require("../models/UserSchema");
const Message = require("../models/chats/MessageSchema");
const Friend = require("../models/FriendRequestSchema");
const Chat = require("../models/chats/ChatSchema");
const PostLike = require("../models/forum/PostLikeSchema");
const {
  likePost,
  unlikePost,
  winkPost,
  unwinkPost,
} = require("../controllers/postController");

let io;
let onlineUsers = new Map(); // In-memory tracking for better performance
let pendingUpdates = new Map(); // Batch database updates
let updateTimer = null;

// Track like spam prevention and pending like updates
let likeSpamProtection = new Map(); // userId -> { lastLikeTime, likeCount, pendingLikes }
let pendingLikeUpdates = new Map(); // postId -> Set of pending like operations

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // replace with your frontend domain in prod
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
  });

  // Batch database updates every 5 seconds
  setInterval(batchUpdateUsers, 5000);

  // Process pending like updates every 3 seconds
  setInterval(processPendingLikeUpdates, 3000);

  io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);

    // Join user to a room for personalized updates
    socket.on("join-user", async (userId) => {
      try {
        // Rate limiting: prevent multiple joins within 1 second
        if (socket.userId && socket.userId === userId) {
          return;
        }

        socket.userId = userId;
        socket.join(`user-${userId}`);

        // Add to in-memory tracking
        onlineUsers.set(userId, {
          socketId: socket.id,
          joinedAt: Date.now(),
          lastActivity: Date.now(),
        });

        // Queue database update instead of immediate write
        queueUserUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Only emit to relevant users (friends, people in same rooms, etc.)
        emitToRelevantUsers("user-online", { userId });

        console.log(`User ${userId} joined their room`);
      } catch (error) {
        console.error("Error in join-user:", error);
      }
    });

    // Handle sending messages via socket
    socket.on("send-message", async (data) => {
      try {
        const { chatId, senderId, receiverId, content, type } = data;

        // Validate required fields
        if (!senderId || !receiverId || !content || !type) {
          socket.emit("message-error", {
            message:
              "Missing required fields: senderId, receiverId, content, and type are required",
          });
          return;
        }

        // Validate content length
        if (content.trim().length === 0) {
          socket.emit("message-error", {
            message: "Message content cannot be empty",
          });
          return;
        }

        // Validate message type
        const validTypes = ["text", "image", "file", "audio", "video"];
        if (!validTypes.includes(type)) {
          socket.emit("message-error", {
            message:
              "Invalid message type. Must be one of: text, image, file, audio, video",
          });
          return;
        }

        // Verify friendship
        const isFriend = await Friend.findOne({
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId },
          ],
          status: "accepted",
        });

        if (!isFriend) {
          socket.emit("message-error", {
            message: "Cannot send message: Users are not friends",
          });
          return;
        }

        let finalChatId = chatId;

        // Create chat if it doesn't exist
        if (!chatId) {
          const existingChat = await Chat.findOne({
            members: { $all: [senderId, receiverId] },
          });

          if (!existingChat) {
            const newChat = await Chat.create({
              members: [senderId, receiverId],
            });
            finalChatId = newChat._id;
            console.log(`New chat created: ${finalChatId}`);
          } else {
            finalChatId = existingChat._id;
          }
        }

        // Create the message
        const newMessage = await Message.create({
          chatId: finalChatId,
          sender: senderId,
          receiver: receiverId,
          content: content.trim(),
          type,
        });

        await newMessage.populate("sender receiver", "username profileImage");

        // Update chat with last message info
        await Chat.findByIdAndUpdate(finalChatId, {
          $set: {
            lastMessage: newMessage._id,
            lastMessageTime: new Date(),
          },
          $inc: {
            [`unreadCount.${receiverId}`]: 1,
          },
        });

        // Emit to sender for confirmation
        socket.emit("message-sent", {
          success: true,
          message: newMessage,
          chatId: finalChatId,
        });

        // Emit to receiver
        io.to(`user-${receiverId}`).emit("new-message", newMessage);

        console.log(
          `Message sent via socket: ${newMessage._id} in chat ${finalChatId}`
        );
      } catch (error) {
        console.error("Error sending message via socket:", error);
        socket.emit("message-error", {
          message: "Internal server error while sending message",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    });

    // Handle forum like toggle with spam protection and delayed DB updates
    socket.on("forum-like-toggle", async ({ postId, userId, isLiked }) => {
      try {
        console.log("Forum like toggle received:", { postId, userId });

        if (!postId || !userId) {
          return;
        }

        // Emit immediate real-time update (always happens)
        io.emit("forum-like-toggle", { postId, userId, isLiked });
        console.log(
          `Real-time update sent: ${postId} by user ${userId}, isLiked: ${isLiked}`
        );

        // Spam prevention for database updates only
        const now = Date.now();
        const userSpamData = likeSpamProtection.get(userId) || {
          lastLikeTime: 0,
          likeCount: 0,
          pendingLikes: new Set(),
        };

        // Reset counter if more than 1 minute has passed
        if (now - userSpamData.lastLikeTime > 60000) {
          userSpamData.likeCount = 0;
        }

        // Check if user is spamming (more than 10 likes per minute)
        if (userSpamData.likeCount >= 10) {
          console.log(
            `User ${userId} is spamming likes - only queuing last action for DB`
          );

          // Still queue the last action for database update (even when spamming)
          const likeKey = `${postId}-${userId}`;

          // Add to pending updates for delayed database processing
          if (!pendingLikeUpdates.has(postId)) {
            pendingLikeUpdates.set(postId, new Set());
          }
          pendingLikeUpdates.get(postId).add(likeKey);

          return;
        }

        // Normal flow - not spamming
        const likeKey = `${postId}-${userId}`;

        // Update spam protection
        userSpamData.lastLikeTime = now;
        userSpamData.likeCount += 1;
        userSpamData.pendingLikes.add(likeKey);
        likeSpamProtection.set(userId, userSpamData);

        // Add to pending updates for delayed database processing
        if (!pendingLikeUpdates.has(postId)) {
          pendingLikeUpdates.set(postId, new Set());
        }
        pendingLikeUpdates.get(postId).add(likeKey);

        console.log(`Like action queued: ${postId} by user ${userId}`);

        // Remove from pending after 2 seconds (simulating processing time)
        setTimeout(() => {
          userSpamData.pendingLikes.delete(likeKey);
          likeSpamProtection.set(userId, userSpamData);
        }, 2000);
      } catch (error) {
        console.error("Error handling forum like toggle:", error);
      }
    });

    socket.on("like-post", async ({ postId, userId }) => {
      try {
        console.log("Like post received:", { postId, userId });
        await likePost({ postId, userId, io });
      } catch (error) {
        console.error("Error handling like post:", error);
      }
    });

    socket.on("unlike-post", async ({ postId, userId }) => {
      try {
        console.log("Unlike post received:", { postId, userId });
        await unlikePost({ postId, userId, io });
      } catch (error) {
        console.error("Error handling unlike post:", error);
      }
    });

    socket.on("wink-post", async ({ postId, userId }) => {
      try {
        console.log("Wink post received:", { postId, userId });
        await winkPost({ postId, userId, io });
      } catch (error) {
        console.error("Error handling wink post:", error);
      } finally {
        io.emit("wink-post", { postId, userId });
      }
    });

    socket.on("unwink-post", async ({ postId, userId }) => {
      try {
        console.log("Unwink post received:", { postId, userId });
        await unwinkPost({ postId, userId, io });
      } catch (error) {
        console.error("Error handling unwink post:", error);
      } finally {
        io.emit("unwink-post", { postId, userId });
      }
    });

    // Handle user activity (heartbeat) with rate limiting
    socket.on("user-activity", async (userId) => {
      try {
        // Rate limit: only update every 30 seconds
        const userData = onlineUsers.get(userId);
        if (userData && Date.now() - userData.lastActivity < 30000) {
          return;
        }

        if (userData) {
          userData.lastActivity = Date.now();
        }

        // Queue update instead of immediate database write
        queueUserUpdate(userId, { lastSeen: new Date() });
      } catch (error) {
        console.error("Error updating user activity:", error);
      }
    });

    socket.on("typing", ({ chatId, userId }) => {
      io.to(`user-${userId}`).emit("typing", { chatId, userId });
    });

    socket.on("stop-typing", ({ chatId, userId }) => {
      io.to(`user-${userId}`).emit("stop-typing", { chatId, userId });
    });

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);

      if (socket.userId) {
        const userId = socket.userId;

        // Remove from in-memory tracking
        onlineUsers.delete(userId);

        // Queue offline status update
        queueUserUpdate(userId, { isOnline: false, lastSeen: new Date() });

        // Emit to relevant users only
        emitToRelevantUsers("user-offline", { userId });

        console.log(`User ${userId} is now offline`);
      }
    });
  });

  return io;
}

// Process pending like updates and update database
async function processPendingLikeUpdates() {
  if (pendingLikeUpdates.size === 0) return;

  try {
    console.log(
      `Processing ${pendingLikeUpdates.size} pending like updates...`
    );

    // Track processed users to avoid duplicate processing
    const processedUsers = new Set();

    for (const [postId, likeOperations] of pendingLikeUpdates) {
      for (const likeKey of likeOperations) {
        const [postIdFromKey, userId] = likeKey.split("-");

        // Skip if we already processed this user's last action
        if (processedUsers.has(userId)) {
          console.log(`Skipping duplicate action for user ${userId}`);
          continue;
        }

        try {
          // Check if user already liked the post
          const existingLike = await PostLike.findOne({
            postId: postIdFromKey,
            userId: userId,
          });

          if (existingLike) {
            // Unlike the post
            await PostLike.findByIdAndDelete(existingLike._id);
            console.log(
              `Post unliked in DB: ${postIdFromKey} by user ${userId}`
            );
          } else {
            // Like the post
            await PostLike.create({
              postId: postIdFromKey,
              userId: userId,
            });
            console.log(`Post liked in DB: ${postIdFromKey} by user ${userId}`);
          }

          // Mark this user as processed
          processedUsers.add(userId);
        } catch (error) {
          console.error(`Error processing like operation ${likeKey}:`, error);
        }
      }
    }

    // Clear processed operations
    pendingLikeUpdates.clear();
    console.log("Pending like updates processed and cleared");
  } catch (error) {
    console.error("Error in processPendingLikeUpdates:", error);
  }
}

// Queue user updates for batching
function queueUserUpdate(userId, updates) {
  if (!pendingUpdates.has(userId)) {
    pendingUpdates.set(userId, {});
  }

  const currentUpdates = pendingUpdates.get(userId);
  Object.assign(currentUpdates, updates);
}

// Batch update users in database
async function batchUpdateUsers() {
  if (pendingUpdates.size === 0) return;

  try {
    const bulkOps = [];

    for (const [userId, updates] of pendingUpdates) {
      bulkOps.push({
        updateOne: {
          filter: { _id: userId },
          update: { $set: updates },
        },
      });
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
      console.log(`Batched ${bulkOps.length} user updates`);
    }

    pendingUpdates.clear();
  } catch (error) {
    console.error("Error in batch update:", error);
  }
}

// Emit only to relevant users instead of broadcasting to all
function emitToRelevantUsers(event, data) {
  // For now, emit to all, but you can implement logic to determine relevant users
  // based on friendships, shared rooms, etc.
  io.emit(event, data);
}

// Cleanup function for graceful shutdown
async function cleanup() {
  try {
    // Process any pending updates before shutdown
    await batchUpdateUsers();
    await processPendingLikeUpdates();

    // Mark all online users as offline
    const onlineUserIds = Array.from(onlineUsers.keys());
    if (onlineUserIds.length > 0) {
      await User.updateMany(
        { _id: { $in: onlineUserIds } },
        { $set: { isOnline: false, lastSeen: new Date() } }
      );
      console.log(
        `Marked ${onlineUserIds.length} users as offline during cleanup`
      );
    }

    // Clear in-memory data
    onlineUsers.clear();
    pendingUpdates.clear();
    likeSpamProtection.clear();
    pendingLikeUpdates.clear();

    if (updateTimer) {
      clearInterval(updateTimer);
    }

    console.log("Socket cleanup completed");
  } catch (error) {
    console.error("Error during socket cleanup:", error);
  }
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// Function to emit notification to a specific user
function emitNotification(userId, notification) {
  if (!io) throw new Error("Socket.io not initialized");

  io.to(`user-${userId}`).emit("new-notification", notification);
  console.log(`Notification emitted to user ${userId}:`, notification.type);
}

// Function to emit unread count update to a specific user
function emitUnreadCountUpdate(userId, count) {
  if (!io) throw new Error("Socket.io not initialized");

  io.to(`user-${userId}`).emit("unread-count-update", { count });
  console.log(`Unread count update emitted to user ${userId}:`, count);
}

// Function to emit notification update (read/delete) to a specific user
function emitNotificationUpdate(userId, updateType, data) {
  if (!io) throw new Error("Socket.io not initialized");

  io.to(`user-${userId}`).emit("notification-update", {
    type: updateType,
    data,
  });
  console.log(`Notification update emitted to user ${userId}:`, updateType);
}

// Function to emit notification type change to a specific user
function emitNotificationTypeChange(
  userId,
  notificationId,
  newType,
  updatedNotification
) {
  if (!io) throw new Error("Socket.io not initialized");

  io.to(`user-${userId}`).emit("notification-type-change", {
    notificationId,
    newType,
    updatedNotification,
  });
  console.log(`Notification type change emitted to user ${userId}:`, newType);
}

// Optimized function to get online users using in-memory data
async function getOnlineUsers(limit = 50) {
  try {
    // Use in-memory data for faster response
    const onlineUserIds = Array.from(onlineUsers.keys());

    if (onlineUserIds.length === 0) {
      return [];
    }

    // Only query database for user details, not online status
    const users = await User.find({ _id: { $in: onlineUserIds } })
      .select("username profilePicture firstName lastName lastSeen")
      .lean();

    // Sort by last activity from in-memory data
    const sortedUsers = users
      .map((user) => ({
        ...user,
        lastSeen:
          onlineUsers.get(user._id.toString())?.lastActivity || user.lastSeen,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit);

    return sortedUsers;
  } catch (error) {
    console.error("Error getting online users:", error);
    return [];
  }
}

// Optimized function to get user's online status
async function getUserOnlineStatus(userId) {
  try {
    // Check in-memory first for faster response
    const inMemoryData = onlineUsers.get(userId);

    if (inMemoryData) {
      // User is online, get basic info from memory
      const user = await User.findById(userId)
        .select("username profilePicture firstName lastName")
        .lean();

      return {
        ...user,
        isOnline: true,
        lastSeen: new Date(inMemoryData.lastActivity),
      };
    } else {
      // User is offline, get from database
      const user = await User.findById(userId)
        .select("isOnline lastSeen username profilePicture firstName lastName")
        .lean();

      return user;
    }
  } catch (error) {
    console.error("Error getting user online status:", error);
    return null;
  }
}

module.exports = {
  initSocket,
  getIO,
  emitNotification,
  emitUnreadCountUpdate,
  emitNotificationUpdate,
  emitNotificationTypeChange,
  getOnlineUsers,
  getUserOnlineStatus,
  cleanup,
};
