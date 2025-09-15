const MeetComment = require("../../models/meet/MeetCommentSchema");
const MeetParticipant = require("../../models/meet/MeetParticipantSchema");

// Helper function to get replies recursively
const getRepliesRecursively = async (parentCommentId) => {
  const replies = await MeetComment.find({
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

// Get comments for an meet
const getMeetComments = async (req, res) => {
  try {
    const { meetId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    // Build query for top-level comments only
    const query = {
      meetId,
      isDeleted: false,
      parentCommentId: null, // Only top-level comments
    };

    const comments = await MeetComment.find(query)
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
    const total = await MeetComment.countDocuments(query);

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
    console.error("Error in getMeetComments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new comment
const createMeetComment = async (req, res) => {
  try {
    const { meetId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Check if user can comment (must be approved/joined participant)
    const participant = await MeetParticipant.findOne({
      meetId,
      userId,
      status: { $in: ["approved", "joined"] },
    });

    if (!participant) {
      return res.status(403).json({
        error: "You must be an approved participant to comment on this meet",
      });
    }

    // If this is a reply, verify parent comment exists
    if (parentCommentId) {
      const parentComment = await MeetComment.findOne({
        _id: parentCommentId,
        meetId,
        isDeleted: false,
      });

      if (!parentComment) {
        return res.status(404).json({ error: "Parent comment not found" });
      }
    }

    const newComment = new MeetComment({
      meetId,
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
    console.error("Error in createMeetComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a comment
const updateMeetComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const comment = await MeetComment.findOne({
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
    console.error("Error in updateMeetComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a comment (soft delete)
const deleteMeetComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await MeetComment.findOne({
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
    console.error("Error in deleteMeetComment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Like/unlike a comment
const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await MeetComment.findOne({
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

    const replies = await MeetComment.find({
      parentCommentId: commentId,
      isDeleted: false,
    })
      .populate("userId", "username profilePicture firstName lastName")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await MeetComment.countDocuments({
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
  getMeetComments,
  createMeetComment,
  updateMeetComment,
  deleteMeetComment,
  toggleCommentLike,
  getCommentReplies,
};
