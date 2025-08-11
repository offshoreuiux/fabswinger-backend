const { Server } = require("socket.io");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // replace with your frontend domain in prod
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join user to a room for personalized updates
    socket.on("join-user", (userId) => {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
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

module.exports = {
  initSocket,
  getIO,
  emitNotification,
  emitUnreadCountUpdate,
  emitNotificationUpdate,
  emitNotificationTypeChange,
};
