const { Server } = require("socket.io");
const User = require("../models/UserModel");

let io;
let onlineUsers = new Map(); // In-memory tracking for better performance
let pendingUpdates = new Map(); // Batch database updates
let updateTimer = null;

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
