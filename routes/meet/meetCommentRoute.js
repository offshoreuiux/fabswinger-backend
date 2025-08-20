const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  getMeetComments,
  createMeetComment,
  updateMeetComment,
  deleteMeetComment,
  toggleCommentLike,
  getCommentReplies,
} = require("../../controllers/meet/meetCommentController");

router.use(authenticateToken);

// Get comments for an meet
router.get("/meet/:meetId", getMeetComments);

// Create a new comment
router.post("/meet/:meetId", createMeetComment);

// Update a comment
router.put("/:commentId", updateMeetComment);

// Delete a comment
router.delete("/:commentId", deleteMeetComment);

// Like/unlike a comment
router.post("/:commentId/like", toggleCommentLike);

// Get replies for a specific comment
router.get("/:commentId/replies", getCommentReplies);

module.exports = router;
