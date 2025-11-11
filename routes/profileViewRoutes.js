const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware");
const {
  trackProfileView,
  getProfileViewers,
  getProfileViewStats,
} = require("../controllers/profileViewController");

router.use(authenticateToken);

// Track a profile view
router.post("/track/:profileId", trackProfileView);

// Get profile viewers for current week
router.get("/viewers", getProfileViewers);

// Get profile view statistics
router.get("/stats", getProfileViewStats);

module.exports = router;
