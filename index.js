// index.js
const express = require("express");
const connectDB = require("./db");
const cors = require("cors");
const http = require("http");
const { initSocket, getIO } = require("./utils/socket");
const User = require("./models/UserSchema");
const bcrypt = require("bcryptjs");

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
const countriesRoutes = require("./routes/countriesRoute");
const adminRoutes = require("./routes/admin/adminRoute");
const NotificationService = require("./services/notificationService");
const { generateDailyMatchesEmail } = require("./utils/emailTemplates");
const transporter = require("./utils/transporter");

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

const { setUserIfToken, restrictAdminToAdminRoutes } = require("./middleware");
app.use(setUserIfToken);
app.use(restrictAdminToAdminRoutes);

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
app.use("/api/countries", countriesRoutes);
app.use("/api/admin", adminRoutes);

// Seed default admin user if missing
(async () => {
  try {
    console.log("Seeding default admin user...");
    const adminEmail = process.env.ADMIN_EMAIL || "admin@yopmail.com";
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log("Admin not found, seeding new admin...");
      const hashed = await bcrypt.hash(adminPassword, 10);
      admin = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashed,
        role: "admin",
        isVerified: true,
        geoLocation: { type: "Point", coordinates: [0, 0] },
      });
      await admin.save();
      console.log("Seeded default admin:", adminEmail);
    }
    // Ensure existing admin has valid geoLocation coordinates for 2dsphere index
    if (
      admin &&
      admin.geoLocation &&
      (!Array.isArray(admin.geoLocation.coordinates) ||
        admin.geoLocation.coordinates.length !== 2)
    ) {
      console.log(
        "Admin geoLocation coordinates are invalid, updating to default coordinates [0,0]"
      );
      admin.geoLocation = { type: "Point", coordinates: [0, 0] };
      console.log("Admin geoLocation updated to default coordinates [0,0]");
      await admin.save();
      console.log("Admin geoLocation saved");
    }
  } catch (err) {
    console.error("Admin seed error:", err?.message || err);
  }
})();

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Schedule daily matches digest at 08:00 server time
const scheduleDailyDigest = async () => {
  try {
    // Run once a day
    setInterval(async () => {
      try {
        const users = await User.find({
          "settings.newMembersMatchMyRequirements": true,
          isActive: true,
        }).select(
          "_id email username ageRange lookingFor geoLocation preferences"
        );

        const getMatches = async (user) => {
          // Simple matching: filter by lookingFor and age range; optionally add location later
          const query = {
            _id: { $ne: user._id },
            gender: {
              $in:
                user.lookingFor && user.lookingFor.length
                  ? user.lookingFor
                  : ["man", "woman"],
            },
            age: {
              $gte: user?.ageRange?.min || 18,
              $lte: user?.ageRange?.max || 65,
            },
            isActive: true,
          };
          // Age is a virtual; approximate by DOB if available
          const minDob = new Date();
          minDob.setFullYear(
            minDob.getFullYear() - (user?.ageRange?.max || 65)
          );
          const maxDob = new Date();
          maxDob.setFullYear(
            maxDob.getFullYear() - (user?.ageRange?.min || 18)
          );

          const dobQuery = { dateOfBirth: { $gte: minDob, $lte: maxDob } };

          const matches = await User.find({
            ...query,
            ...dobQuery,
          })
            .limit(10)
            .select("_id username nickname profileImage about");

          return matches;
        };

        const sent = await NotificationService.sendDailyMatchesDigest({
          transporter,
          users,
          getMatches,
          generateEmail: generateDailyMatchesEmail,
        });
        if (sent) {
          console.log(`Daily matches digest sent to ${sent} users`);
        }
      } catch (err) {
        console.error("Daily digest scheduler error:", err?.message || err);
      }
    }, 24 * 60 * 60 * 1000); // every 24h
  } catch (e) {
    console.error("Failed to schedule daily digest:", e?.message || e);
  }
};

scheduleDailyDigest();
