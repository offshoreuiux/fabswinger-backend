const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware");
const {
  updateProfile,
  getProfile,
  getProfileById,
  getPublicProfileById,
  updateProfileImage,
  deleteProfileImage,
  updatePassword,
  getProfiles,
  updateLocation,
  updateProfileSettings,
  getOnlineUsers,
  createUserReview,
  getUserReviews,
  hideProfile,
} = require("../controllers/profileController");
const upload = require("../middleware/upload");

// All profile routes require authentication
router.get("/public/:id", getPublicProfileById);

router.use(authenticateToken);

// Get current user's profile
router.get("/", getProfile);

router.get("/profiles", getProfiles);

// Update current user's profile
router.put("/", updateProfile);

router.put("/update-location", updateLocation);

// Update current user's password
router.put("/password", updatePassword);

// Get profile by ID (for viewing other users)
router.get("/private/:id", getProfileById);

// Update profile images
router.put("/avatar", upload.single("avatar"), updateProfileImage);

// Delete profile image
router.delete("/avatar", deleteProfileImage);

router.put("/settings", updateProfileSettings);

router.get("/online-users", getOnlineUsers);

router.get("/reviews/:userId", getUserReviews);

router.post("/reviews", createUserReview);

router.put("/hide", hideProfile);

module.exports = router;
