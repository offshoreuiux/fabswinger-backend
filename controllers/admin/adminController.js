const User = require("../../models/user/UserSchema");
const Verification = require("../../models/VerificationSchema");
const {
  generateVerificationApprovedEmail,
  generateVerificationRejectedEmail,
  generateClubVerificationApprovedEmail,
  generateClubVerificationRejectedEmail,
} = require("../../utils/emailTemplates");
const { sendMail } = require("../../utils/transporter");

// GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(
        { role: "user" },
        {
          username: 1,
          email: 1,
          lastSeen: 1,
          isActive: 1,
          createdAt: 1,
          profileImage: 1,
        }
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({}),
    ]);

    const hasMore = page * limit < total;
    console.log(
      `✅ List Users API successful - returned ${users.length} users`
    );
    res.json({ users, total, page, hasMore });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// POST /api/admin/users/:userId/toggle-user-activation
const toggleUserActivation = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isActive = !user.isActive;
    await user.save();
    console.log(
      `✅ Toggle User Activation API successful for userId: ${userId} - isActive: ${user.isActive}`
    );
    res.json({
      user,
      message: user.isActive ? "User activated" : "User deactivated",
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle user activation" });
  }
};

const fetchVerificationRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "all", type = "users" } = req.query;
    const skip = (page - 1) * limit;
    const query = {};

    // Filter by status
    if (status !== "all") {
      query.status = status;
    }

    // Filter by type
    if (type === "users") {
      query.type = "user";
    } else if (type === "clubs") {
      query.type = "club";
    }

    const verificationRequests = await Verification.find(query)
      .populate("userId", "username email profileImage")
      .populate("clubId", "name email contactEmail image")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Verification.countDocuments(query);
    const hasMore = limit == verificationRequests.length;

    console.log(
      `✅ Fetch Verification Requests API successful - returned ${verificationRequests.length} requests`
    );

    res.status(200).json({
      verifications: verificationRequests,
      total,
      page: parseInt(page),
      hasMore,
      message: "Verification requests fetched successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch verification requests" });
  }
};

const verifyVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status } = req.body;
    const verification = await Verification.findById(verificationId)
      .populate("userId", "username email profileImage isVerified")
      .populate("clubId", "name email contactEmail isVerified");

    if (!verification) {
      return res.status(404).json({ error: "Verification not found" });
    }

    let entity;
    let entityType;

    if (verification.type === "user") {
      entity = await User.findById(verification.userId._id);
      entityType = "user";
      if (!entity) {
        return res.status(404).json({ error: "User not found" });
      }
    } else if (verification.type === "club") {
      const Club = require("../../models/club/ClubSchema");
      entity = await Club.findById(verification.clubId._id);
      entityType = "club";
      if (!entity) {
        return res.status(404).json({ error: "Club not found" });
      }
    }

    // Update verification status
    entity.isVerified = status === "verified";
    await entity.save();

    verification.status = status;
    await verification.save();

    // Send email notification
    const email = entityType === "user" ? entity.email : verification.clubEmail;
    const name = entityType === "user" ? entity.username : entity.name;

    console.log("email", entity);

    // Use appropriate email templates based on verification type
    const mailOptions = {
      to: email,
      subject:
        status === "verified"
          ? entityType === "user"
            ? "Verification Approved"
            : "Club Verification Approved"
          : entityType === "user"
          ? "Verification Rejected"
          : "Club Verification Rejected",
      html:
        status === "verified"
          ? entityType === "user"
            ? generateVerificationApprovedEmail(name)
            : generateClubVerificationApprovedEmail(name)
          : entityType === "user"
          ? generateVerificationRejectedEmail(name)
          : generateClubVerificationRejectedEmail(name),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };

    const emailResponse = await sendMail(mailOptions);
    console.log("emailResponse", emailResponse);

    console.log(
      `✅ Verify Verification API successful - ${entityType} ${status} for verificationId: ${verificationId}`
    );

    res.json({
      message:
        status === "verified"
          ? `${entityType === "user" ? "User" : "Club"} verified successfully`
          : `${entityType === "user" ? "User" : "Club"} rejected successfully`,
      verification,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify verification" });
  }
};

// GET /api/admin/verification-stats
const getVerificationStats = async (req, res) => {
  try {
    const [
      pendingUserVerifications,
      pendingClubVerifications,
      totalUserVerifications,
      totalClubVerifications,
      verifiedUsers,
      verifiedClubs,
    ] = await Promise.all([
      Verification.countDocuments({ type: "user", status: "pending" }),
      Verification.countDocuments({ type: "club", status: "pending" }),
      Verification.countDocuments({ type: "user" }),
      Verification.countDocuments({ type: "club" }),
      User.countDocuments({ isVerified: true, role: "user" }),
      require("../../models/club/ClubSchema").countDocuments({
        isVerified: true,
      }),
    ]);

    console.log(`✅ Get Verification Stats API successful`);

    res.json({
      pendingUserVerifications,
      pendingClubVerifications,
      totalUserVerifications,
      totalClubVerifications,
      verifiedUsers,
      verifiedClubs,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch verification stats" });
  }
};

module.exports = {
  listUsers,
  toggleUserActivation,
  fetchVerificationRequests,
  verifyVerification,
  getVerificationStats,
};
