const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  getEventComments,
  createEventComment,
  updateEventComment,
  deleteEventComment,
  toggleCommentLike,
  getCommentReplies,
} = require("../../controllers/event/eventCommentController");

router.use(authenticateToken);

// Get comments for an event
router.get("/event/:eventId", getEventComments);

// Create a new comment
router.post("/event/:eventId", createEventComment);

// Update a comment
router.put("/:commentId", updateEventComment);

// Delete a comment
router.delete("/:commentId", deleteEventComment);

// Like/unlike a comment
router.post("/:commentId/like", toggleCommentLike);

// Get replies for a specific comment
router.get("/:commentId/replies", getCommentReplies);

module.exports = router;
