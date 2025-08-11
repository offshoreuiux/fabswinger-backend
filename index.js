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

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
