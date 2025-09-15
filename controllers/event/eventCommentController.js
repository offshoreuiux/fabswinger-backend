const EventComment = require("../../models/event/EventCommentSchema");
const EventParticipant = require("../../models/event/EventParticipantSchema");

// Helper function to get replies recursively
const getRepliesRecursively = async (parentCommentId) => {
  const replies = await EventComment.find({
    parentCommentId: parentCommentId,
    isDeleted: false,
  })
    .populate("userId", "username profileImage firstName lastName")
    .sort({ createdAt: 1 })
    .lean();

  // For each reply, get its nested replies
  const repliesWithNested = await Promise.all(
    replies.map(async (reply) => {
      const nestedReplies = await getRepliesRecursively(reply._id);
      return {
        ...reply,
        replies: nestedReplies,
        replyCount: nestedReplies.length,
      };
    })
  );

  return repliesWithNested;
};

// Get comments for an event
const getEventComments = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    // Build query for top-level comments only
    const query = {
      eventId,
      isDeleted: false,
      parentCommentId: null, // Only top-level comments
    };

    const comments = await EventComment.find(query)
      .populate("userId", "username profileImage firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // For each comment, fetch its replies recursively
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        // Get replies for this comment recursively
        const replies = await getRepliesRecursively(comment._id);

        return {
          ...comment,
          replies,
          replyCount: replies.length,
        };
      })
    );

    // Get total count for pagination
    const total = await EventComment.countDocuments(query);

    res.json({
      comments: commentsWithReplies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalComments: total,
        hasNextPage: skip + comments.length < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in getEventComments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new comment
const createEventComment = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Check if user can comment (must be approved/joined participant)
    const participant = await EventParticipant.findOne({
      eventId,
      userId,
      status: { $in: ["approved", "joined"] },
    });

    if (!participant) {
      return res.status(403).json({
        error: "You must be an approved participant to comment on this event",
      });
    }

    // If this is a reply, verify parent comment exists
    if (parentCommentId) {
      const parentComment = await EventComment.findOne({
        _id: parentCommentId,
        eventId,
        isDeleted: false,
      });

      if (!parentComment) {
        return res.status(404).json({ error: "Parent comment not found" });
      }
    }

    const newComment = new EventComment({
      eventId,
      userId,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
    });

    await newComment.save();

    // Populate user info for response
    await newComment.populate(
      "userId",
      "username profileImage firstName lastName"
    );

    res.status(201).json({
      message: "Comment created successfully",
      comment: newComment,
    });
  } catch (error) {
    console.error("Error in createEventComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a comment
const updateEventComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const comment = await EventComment.findOne({
      _id: commentId,
      userId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        error: "Comment not found or you don't have permission to edit it",
      });
    }

    // Check if comment is too old to edit (e.g., 24 hours)
    const hoursSinceCreation =
      (Date.now() - comment.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return res.status(400).json({
        error: "Comments can only be edited within 24 hours of creation",
      });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();

    res.json({
      message: "Comment updated successfully",
      comment,
    });
  } catch (error) {
    console.error("Error in updateEventComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a comment (soft delete)
const deleteEventComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await EventComment.findOne({
      _id: commentId,
      userId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        error: "Comment not found or you don't have permission to delete it",
      });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    res.json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteEventComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Like/unlike a comment
const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await EventComment.findOne({
      _id: commentId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
      // Unlike
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
    } else {
      // Like
      comment.likes.push(userId);
    }

    await comment.save();

    res.json({
      message: isLiked ? "Comment unliked" : "Comment liked",
      isLiked: !isLiked,
      likeCount: comment.likes.length,
    });
  } catch (error) {
    console.error("Error in toggleCommentLike:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get replies for a specific comment
const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const replies = await EventComment.find({
      parentCommentId: commentId,
      isDeleted: false,
    })
      .populate("userId", "username profilePicture firstName lastName")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await EventComment.countDocuments({
      parentCommentId: commentId,
      isDeleted: false,
    });

    res.json({
      replies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReplies: total,
        hasNextPage: skip + replies.length < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in getCommentReplies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getEventComments,
  createEventComment,
  updateEventComment,
  deleteEventComment,
  toggleCommentLike,
  getCommentReplies,
};
