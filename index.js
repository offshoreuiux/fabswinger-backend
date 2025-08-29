// index.js
const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
const http = require("http");
const { initSocket, getIO } = require("./utils/socket");

const authRoutes = require("./routes/authRoute");
const profileRoutes = require("./routes/profileRoute");
const postRoutes = require("./routes/postRoute");
const hotlistRoutes = require("./routes/hotlistRoute");
const friendRoutes = require("./routes/friendsRoute");
const notificationRoutes = require("./routes/notificationRoute");
const eventRoutes = require("./routes/event/eventRoute");
const eventCommentRoutes = require("./routes/event/eventCommentRoute");
const eventParticipantRoutes = require("./routes/event/eventParticipantRoute");
const clubRoutes = require("./routes/club/clubRoute");
const clubReviewRoutes = require("./routes/club/clubReviewRoute");
const meetRoutes = require("./routes/meet/meetRoute");
const meetCommentRoutes = require("./routes/meet/meetCommentRoute");
const meetParticipantRoutes = require("./routes/meet/meetParticipantRoute");
const chatRoutes = require("./routes/chat/chatRoute");
const messageRoutes = require("./routes/chat/messageRoute");
const forumRoutes = require("./routes/forumRoute");

const app = express();
const server = http.createServer(app);
app.use(cors()); // allow frontend to access
app.use(express.json());

require("dotenv").config();
const PORT = process.env.PORT || 3000;
connectDB();

// Initialize socket and make io available to controllers
initSocket(server);
app.set("io", getIO());

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/post", postRoutes);
app.use("/api/hotlist", hotlistRoutes);
app.use("/api/friend", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/event-comments", eventCommentRoutes);
app.use("/api/event-participants", eventParticipantRoutes);
app.use("/api/club", clubRoutes);
app.use("/api/club-reviews", clubReviewRoutes);
app.use("/api/meets", meetRoutes);
app.use("/api/meet-comments", meetCommentRoutes);
app.use("/api/meet-participants", meetParticipantRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/forum", forumRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
