const { Server } = require("socket.io");
const User = require("../models/user/UserSchema");
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
const { winkProfile } = require("../controllers/profileController");
const NotificationService = require("../services/notificationService");
// Track scheduled missed-message email timers per chat and recipient
let pendingMissedEmailTimers = new Map(); // key: `${chatId}:${userId}` -> Timeout
const { sendMail } = require("./transporter");
const { generatePrivateMessageEmail } = require("./emailTemplates");
const SubscriptionSchema = require("../models/payment/SubscriptionSchema");

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

        // Emit online count update to all connected users
        io.emit("online-count-update", { count: onlineUsers.size });

        console.log(`User ${userId} joined their room`);
      } catch (error) {
        console.error("Error in join-user:", error);
      }
    });

    // Handle sending messages via socket
    socket.on("send-message", async (data) => {
      try {
        const { chatId, senderId, receiverId, content, type, tempId } = data;

        // Validate required fields
        if (!senderId || !content || !type || !receiverId) {
          socket.emit("message-error", {
            message:
              "Missing required fields: senderId, content, type, and receiverId are required",
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

        // Get chat to determine type and validate permissions
        let chat;
        if (chatId) {
          chat = await Chat.findById(chatId);
          if (!chat) {
            socket.emit("message-error", {
              message: "Chat not found",
            });
            return;
          }

          // Check if sender is a member of the chat
          if (!chat.members.includes(senderId)) {
            socket.emit("message-error", {
              message: "You are not a member of this chat",
            });
            return;
          }
        } else {
          // For private chats without chatId, verify friendship
          if (!receiverId) {
            socket.emit("message-error", {
              message: "receiverId is required for private chats",
            });
            return;
          }

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
        }

        let finalChatId = chatId;

        // Create chat if it doesn't exist (only for private chats)
        if (!chatId) {
          const existingChat = await Chat.findOne({
            members: { $all: [senderId, receiverId] },
            type: "private",
          });

          if (!existingChat) {
            const newChat = await Chat.create({
              members: [senderId, receiverId],
              type: "private",
            });
            finalChatId = newChat._id;
            console.log(`New private chat created: ${finalChatId}`);
          } else {
            finalChatId = existingChat._id;
          }
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0); // today 00:00

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999); // today 23:59

        const count = await Message.countDocuments({
          sender: senderId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        });
        console.log("count", count);

        const subscription = await SubscriptionSchema.findOne({
          userId: senderId,
        });
        console.log("subscription?.status", subscription?.status);

        if (
          (!subscription && count > 10) ||
          (subscription?.status !== "active" && count >= 10)
        ) {
          console.error(
            "Daily message limit reached. Upgrade your plan to send more."
          );
          socket.emit("message-error", {
            message:
              "Daily message limit reached. Upgrade your plan to send more.",
            details:
              process.env.NODE_ENV === "development"
                ? "Daily message limit reached. Upgrade your plan to send more."
                : undefined,
          });
          return;
        }

        // Create the message
        const messageData = {
          chatId: finalChatId,
          sender: senderId,
          content: content.trim(),
          type,
        };

        // Only add receiver for private chats
        if (chat?.type === "private" || (!chat && receiverId)) {
          messageData.receiver = receiverId;
        }

        const newMessage = await Message.create(messageData);

        // Populate sender and receiver (if exists)
        const populateFields = ["sender"];
        if (messageData.receiver) {
          populateFields.push("receiver");
        }
        await newMessage.populate(
          populateFields.join(" "),
          "username profileImage"
        );

        // Get chat members for unread count update
        const chatForUpdate = chat || (await Chat.findById(finalChatId));
        const chatMembers = chatForUpdate.members.filter(
          (memberId) => memberId.toString() !== senderId
        );

        // Update chat with last message info and unread counts
        const updateData = {
          $set: {
            lastMessage: newMessage._id,
            lastMessageTime: new Date(),
          },
        };

        // Increment unread count for all members except sender.
        // Also detect transition from 0->1 to trigger missed-message email.
        const shouldEmailForMember = {};
        chatMembers.forEach((memberId) => {
          updateData.$inc = updateData.$inc || {};
          updateData.$inc[`unreadCount.${memberId}`] = 1;
          try {
            let currentUnread = 0;
            if (chatForUpdate && chatForUpdate.unreadCount) {
              const uc = chatForUpdate.unreadCount;
              if (typeof uc.get === "function") {
                currentUnread = uc.get(memberId.toString()) || 0;
              } else if (typeof uc === "object") {
                currentUnread = uc[memberId.toString()] || 0;
              }
            }
            if (!currentUnread || currentUnread === 0) {
              shouldEmailForMember[memberId.toString()] = true;
            }
          } catch (_) {}
        });

        await Chat.findByIdAndUpdate(finalChatId, updateData);

        // Send in-app notifications to all members except sender
        // And schedule a delayed email if the message remains unread for 15 minutes
        for (const memberId of chatMembers) {
          const user = await User.findById(memberId);
          await NotificationService.createPrivateMessageNotification(
            senderId,
            memberId,
            finalChatId,
            content
          );

          // Schedule delayed email if user allows emails and they currently have 0->1 transition
          if (
            shouldEmailForMember[memberId.toString()] &&
            user?.settings?.getPrivateMessages
          ) {
            const key = `${finalChatId}:${memberId.toString()}`;
            if (!pendingMissedEmailTimers.has(key)) {
              const timer = setTimeout(async () => {
                try {
                  // Check if still unread after delay
                  const chatDoc = await Chat.findById(finalChatId).lean();
                  let unreadForUser = 0;
                  if (chatDoc?.unreadCount) {
                    if (chatDoc.unreadCount.get) {
                      unreadForUser =
                        chatDoc.unreadCount.get(memberId.toString()) || 0;
                    } else if (typeof chatDoc.unreadCount === "object") {
                      unreadForUser =
                        chatDoc.unreadCount[memberId.toString()] || 0;
                    }
                  }
                  if (unreadForUser > 0) {
                    try {
                      const mailOptions = {
                        to: user.email,
                        subject: "You have unread messages",
                        html: generatePrivateMessageEmail(
                          senderId,
                          memberId,
                          finalChatId,
                          content
                        ),
                        from:
                          process.env.SENDGRID_FROM_EMAIL ||
                          process.env.SMTP_USER,
                      };
                      await sendMail(mailOptions);
                      console.log(`Missed message email sent to ${user.email}`);
                    } catch (e) {
                      console.error("Missed message email error:", e);
                    }
                  }
                } catch (e) {
                  console.error("Missed message check error:", e);
                } finally {
                  pendingMissedEmailTimers.delete(key);
                }
              }, 15 * 60 * 1000); // 15 minutes
              pendingMissedEmailTimers.set(key, timer);
            }
          }
        }

        // Emit to sender for confirmation
        socket.emit("message-sent", {
          success: true,
          message: newMessage,
          chatId: finalChatId,
          tempId,
        });
        console.log("message-sent", newMessage);

        // Emit to all chat members except sender
        chatMembers.forEach((memberId) => {
          console.log("chatMembers", memberId.toString());
          io.to(`user-${memberId.toString()}`).emit("new-message", newMessage);
        });

        console.log(
          `Message sent via socket: ${newMessage._id} in chat ${finalChatId}`
        );
      } catch (error) {
        console.error("Error sending message via socket:", error);
        socket.emit("message-error", {
          message:
            error?.message ||
            error ||
            "Internal server error while sending message",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    });

    // Mark a chat as read by a user: reset unreadCount for that user and mark messages read
    socket.on("chat-mark-read", async ({ chatId, userId }) => {
      try {
        if (!chatId || !userId) return;
        await Chat.findByIdAndUpdate(chatId, {
          $set: { [`unreadCount.${userId}`]: 0 },
        });
        try {
          await Message.updateMany(
            { chatId, receiver: userId, status: { $ne: "read" } },
            { $set: { status: "read" } }
          );
        } catch (_) {}
        io.to(`user-${userId}`).emit("chat-unread-reset", { chatId, userId });
      } catch (error) {
        console.error("Error in chat-mark-read:", error);
      }
    });

    socket.on("wink-profile", async ({ profileId, userId }) => {
      try {
        console.log("Wink profile received:", { profileId, userId });
        await winkProfile({ profileId, userId, io });
      } catch (error) {
        console.error("Error handling wink profile:", error);
      }
    });

    // Mark a chat as read by a user: reset unread count for that user and mark messages read
    socket.on("chat-mark-read", async ({ chatId, userId }) => {
      try {
        if (!chatId || !userId) return;
        await Chat.findByIdAndUpdate(chatId, {
          $set: { [`unreadCount.${userId}`]: 0 },
        });
        try {
          await Message.updateMany(
            { chatId, receiver: userId, status: { $ne: "read" } },
            { $set: { status: "read", isRead: true } }
          );
        } catch (_) {}
        // Cancel any pending missed-email timer for this chat/user
        const key = `${chatId}:${userId}`;
        const t = pendingMissedEmailTimers.get(key);
        if (t) {
          clearTimeout(t);
          pendingMissedEmailTimers.delete(key);
        }
        io.to(`user-${userId}`).emit("chat-unread-reset", { chatId, userId });
      } catch (error) {
        console.error("Error in chat-mark-read:", error);
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

    // WebRTC signaling events
    // Send call invitation to chat members
    socket.on(
      "webrtc-call-invitation",
      async ({ chatId, senderId, withVideo }) => {
        try {
          if (!chatId || !senderId) return;
          const chat = await Chat.findById(chatId).lean();
          if (!chat) return;
          const recipients = chat.members.filter(
            (memberId) => memberId.toString() !== senderId
          );
          recipients.forEach((memberId) => {
            io.to(`user-${memberId}`).emit("webrtc-call-invitation", {
              chatId,
              senderId,
              withVideo,
            });
          });
        } catch (error) {
          console.error("Error in webrtc-call-invitation:", error);
        }
      }
    );

    // Handle call response (accept/decline)
    socket.on(
      "webrtc-call-response",
      async ({ chatId, senderId, accepted, withVideo }) => {
        try {
          if (!chatId || !senderId) return;
          const chat = await Chat.findById(chatId).lean();
          if (!chat) return;

          // Find the original caller (the one who sent the invitation)
          // We need to send the response back to all members except the responder
          const recipients = chat.members.filter(
            (memberId) => memberId.toString() !== senderId
          );
          recipients.forEach((memberId) => {
            io.to(`user-${memberId}`).emit("webrtc-call-response", {
              chatId,
              senderId,
              accepted,
              withVideo,
            });
          });
        } catch (error) {
          console.error("Error in webrtc-call-response:", error);
        }
      }
    );

    // Join an audio call for a chat. Not a room join, just notify members.
    socket.on("webrtc-join-call", async ({ chatId, senderId }) => {
      try {
        if (!chatId || !senderId) return;
        const chat = await Chat.findById(chatId).lean();
        if (!chat) return;
        const recipients = chat.members.filter(
          (memberId) => memberId.toString() !== senderId
        );
        recipients.forEach((memberId) => {
          io.to(`user-${memberId}`).emit("webrtc-participant-joined", {
            chatId,
            userId: senderId,
          });
        });
      } catch (error) {
        console.error("Error in webrtc-join-call:", error);
      }
    });

    socket.on(
      "webrtc-offer",
      async ({ chatId, senderId, targetUserId, sdp }) => {
        try {
          if (!chatId || !senderId || !targetUserId || !sdp) return;
          io.to(`user-${targetUserId}`).emit("webrtc-offer", {
            chatId,
            senderId,
            sdp,
          });
        } catch (error) {
          console.error("Error in webrtc-offer:", error);
        }
      }
    );

    socket.on(
      "webrtc-answer",
      async ({ chatId, senderId, targetUserId, sdp }) => {
        try {
          if (!chatId || !senderId || !targetUserId || !sdp) return;
          io.to(`user-${targetUserId}`).emit("webrtc-answer", {
            chatId,
            senderId,
            sdp,
          });
        } catch (error) {
          console.error("Error in webrtc-answer:", error);
        }
      }
    );

    socket.on(
      "webrtc-ice-candidate",
      async ({ chatId, senderId, targetUserId, candidate }) => {
        try {
          if (!chatId || !senderId || !targetUserId || !candidate) return;
          io.to(`user-${targetUserId}`).emit("webrtc-ice-candidate", {
            chatId,
            senderId,
            candidate,
          });
        } catch (error) {
          console.error("Error in webrtc-ice-candidate:", error);
        }
      }
    );

    socket.on("webrtc-leave-call", async ({ chatId, senderId }) => {
      try {
        if (!chatId || !senderId) return;
        const chat = await Chat.findById(chatId).lean();
        if (!chat) return;
        const recipients = chat.members.filter(
          (memberId) => memberId.toString() !== senderId
        );
        recipients.forEach((memberId) => {
          io.to(`user-${memberId}`).emit("webrtc-participant-left", {
            chatId,
            userId: senderId,
          });
        });
      } catch (error) {
        console.error("Error in webrtc-leave-call:", error);
      }
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

        // Emit online count update to all connected users
        io.emit("online-count-update", { count: onlineUsers.size });

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
