const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  createClubReview,
  getClubReviews,
} = require("../../controllers/club/clubReviewController");

router.use(authenticateToken);

router.post("/:clubId", createClubReview);
router.get("/:clubId", getClubReviews);

module.exports = router;
