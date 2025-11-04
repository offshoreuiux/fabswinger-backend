const Post = require("../../models/forum/PostSchema");
const Channel = require("../../models/forum/ChannelSchema");
const Member = require("../../models/forum/MemberSchema");
const Like = require("../../models/forum/PostLikeSchema");
const PostView = require("../../models/forum/PostViewSchema");
const { s3, getS3KeyFromUrl } = require("../../utils/s3");
const { v4: uuidv4 } = require("uuid");
const NotificationService = require("../../services/notificationService");
const Comment = require("../../models/forum/PostCommentSchema");
const SubscriptionSchema = require("../../models/payment/SubscriptionSchema");
const mongoose = require("mongoose");

const createPost = async (req, res) => {
  const { caption, channelId } = req.body;
  const image = req.file;
  const userId = req.user.userId;
  let imageUrl;

  //Calculate today's range
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  //Count how many image/video posts the user has made today
  const count = await Post.countDocuments({
    createdBy: userId,
    content: { $exists: true, $ne: null },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
  console.log("Today's post count:", count);

  //Get user subscription
  const subscription = await SubscriptionSchema.findOne({ userId });
  console.log("subscription?.status:", subscription?.status);

  //Enforce daily limits
  //No subscription OR inactive subscription → 1 post/day
  //Active subscription → 10 posts/day
  if (
    (!subscription && count >= 1) ||
    (subscription?.status !== "active" && count >= 1) ||
    (subscription?.status === "active" && count >= 10)
  ) {
    return res.status(403).json({
      success: false,
      message:
        subscription?.status === "active"
          ? "Daily post limit (10) reached. Try again tomorrow."
          : "Daily post limit (1) reached. Upgrade your plan to post more.",
    });
  }

  if (channelId) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });
    }

    const isMember = await Member.findOne({
      userId,
      channelId,
    });
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this channel",
      });
    }

    if (image) {
      const fileName = `forum/images/${uuidv4()}-${image.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: image.buffer,
        ContentType: image.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location;
    }

    console.log("imageUrl", imageUrl);

    const post = await Post.create({
      caption,
      createdBy: userId,
      channelId,
      content: imageUrl,
    });

    const populatedPost = await Post.findById(post._id)
      .populate("createdBy", "username profileImage")
      .populate("channelId", "name image");

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  } else {
    if (image) {
      const fileName = `forum/images/${uuidv4()}-${image.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: image.buffer,
        ContentType: image.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location;
    }
    const post = await Post.create({
      caption,
      content: imageUrl,
      createdBy: userId,
    });

    const populatedPost = await Post.findById(post._id)
      .populate("createdBy", "username profileImage")
      .populate("channelId", "name image");

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  }
};

const getPosts = async (req, res) => {
  const { limit = 10, page = 1 } = req.query;

  const posts = await Post.find()
    .limit(limit)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .populate("channelId", "name image")
    .populate("createdBy", "username profileImage settings");

  const visiblePosts = posts.filter((post) => {
    const settings = post?.createdBy?.settings;
    // Keep if profileVisibility is not explicitly false or doesn't exist
    return settings?.profileVisibility !== false;
  });

  const isLiked = await Like.find({
    postId: visiblePosts.map((each) => each._id),
    userId: req.user.userId,
  }).select("postId");

  const likes = await Like.find({
    postId: visiblePosts.map((each) => each._id),
  });

  const comments = await Comment.find({
    postId: visiblePosts.map((each) => each._id),
  });

  const isMember = await Member.find({
    channelId: visiblePosts.map((each) => each.channelId),
    userId: req.user.userId,
  });

  const postsWithIsLiked = visiblePosts.map((each) => {
    const obj = each.toObject();
    obj.isLiked = isLiked.some((like) => like.postId.equals(each._id))
      ? true
      : false;
    obj.likes = likes.filter((like) => like.postId.equals(each._id)).length;
    obj.comments = comments.filter((comment) =>
      comment.postId.equals(each._id)
    ).length;
    obj.isMember = isMember.some((member) =>
      member.channelId.equals(each.channelId?._id)
    )
      ? true
      : false;
    return obj;
  });

  const totalPosts = await Post.countDocuments();

  return res.status(200).json({
    posts: postsWithIsLiked,
    totalPosts,
    page,
    hasMore: page * limit < totalPosts,
  });
};

const deletePost = async (req, res) => {
  const { postId } = req.params;
  if (!postId) {
    return res
      .status(400)
      .json({ success: false, message: "Post ID is required" });
  }
  const post = await Post.findOne({ _id: postId });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }
  if (
    post.createdBy.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to delete this post",
    });
  }
  await Promise.all([
    Post.findByIdAndDelete(postId),
    Comment.deleteMany({ postId }),
    Like.deleteMany({ postId }),
    PostView.deleteMany({ postId }),
  ]);
  const key = getS3KeyFromUrl(post.content);
  await s3
    .deleteObject({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    })
    .promise();
  return res
    .status(200)
    .json({ success: true, message: "Post deleted successfully" });
};

const getPostByChannelId = async (req, res) => {
  const { channelId } = req.params;
  const { limit = 10, page = 1 } = req.query;

  if (!channelId) {
    return res.status(400).json({ message: "Channel ID is required" });
  }

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  const posts = await Post.find({ channelId })
    .limit(limit)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .populate("channelId", "name image")
    .populate("createdBy", "username")
    .select("caption content createdBy channelId createdAt views");

  const comments = await Comment.find({
    postId: posts.map((each) => each._id),
  });

  const isMember = await Member.find({
    channelId: posts.map((each) => each.channelId),
    userId: req.user.userId,
  });

  const isLiked = await Like.find({
    postId: posts.map((each) => each._id),
    userId: req.user.userId,
  }).select("postId");

  const likes = await Like.find({
    postId: posts.map((each) => each._id),
  });

  const postsWithComments = posts.map((each) => {
    const obj = each.toObject();
    obj.comments = comments.filter((comment) =>
      comment.postId.equals(each._id)
    ).length;
    obj.isMember = isMember.some((member) =>
      member.channelId.equals(each.channelId?._id)
    )
      ? true
      : false;
    obj.isLiked = isLiked.some((like) => like.postId.equals(each._id))
      ? true
      : false;
    obj.likes = likes.filter((like) => like.postId.equals(each._id)).length;
    return obj;
  });

  const totalPosts = await Post.countDocuments({ channelId });

  return res.status(200).json({
    posts: postsWithComments,
    totalPosts,
    page,
    hasMore: page * limit < totalPosts,
  });
};

// const togglePostLike = async (req, res) => {
//   const { postId } = req.params;
//   const userId = req.user.userId;

//   const post = await Post.findById(postId);
//   if (!post) {
//     return res.status(404).json({ message: "Post not found" });
//   }

//   const isLiked = await Like.findOne({ postId, userId });

//   if (isLiked) {
//     await Like.findByIdAndDelete(isLiked._id);
//     return res.status(200).json({
//       success: true,
//       message: "Post unliked successfully",
//       postId,
//     });
//   }

//   await Like.create({ postId, userId });

//   await NotificationService.createForumLikeNotification(
//     userId,
//     post.createdBy,
//     postId
//   );

//   return res.status(200).json({
//     success: true,
//     message: "Post liked successfully",
//     postId,
//   });
// };

const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    if (!postId) {
      return res
        .status(400)
        .json({ success: false, message: "Post ID is required" });
    }

    const post = await Post.findById(postId)
      .populate("channelId", "name image createdAt description")
      .populate("createdBy", "username profileImage");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const isLiked = await Like.findOne({ postId, userId });
    const postObject = post.toObject();
    postObject.isLiked = isLiked ? true : false;

    const likes = await Like.find({ postId });
    postObject.likes = likes.length;
    console.log(post);

    if (post?.channelId?._id) {
      const isMember = await Member.findOne({
        userId,
        channelId: post.channelId._id,
      });
      postObject.isMember = isMember ? true : false;

      const members = await Member.find({ channelId: post.channelId._id });
      postObject.members = members.length;

      const posts = await Post.find({ channelId: post.channelId._id });
      postObject.posts = posts.length;
    }

    postObject.isOwner = post.createdBy?._id.equals(userId);

    return res.status(200).json({ post: postObject, success: true });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const addComment = async (req, res) => {
  try {
    const { postId, content, parentId, filter } = req.body;

    if (!postId || !content) {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user.userId,
      content,
      parentCommentId: parentId || null,
    });

    if (comment && post.createdBy._id !== req.user.userId) {
      await NotificationService.createForumCommentNotification(
        req.user.userId,
        post.createdBy,
        postId,
        parentId
      );
    }

    const populatedComment = await Comment.findById(comment._id).populate(
      "userId",
      "username profileImage"
    );

    return res.status(200).json({
      success: true,
      message: "Comment added successfully",
      comment: populatedComment,
      filter,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;
    const skip = (page - 1) * limit;

    console.log("Sort parameter received:", sort); // Debug log

    // Get total count for pagination
    const totalComments = await Comment.countDocuments({
      postId: new mongoose.Types.ObjectId(postId),
      parentCommentId: null, // Only count top-level comments
    });

    // Get paginated top-level comments
    const topLevelComments = await Comment.aggregate([
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
          parentCommentId: null,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          username: "$user.username",
          profileImage: "$user.profileImage",
          content: 1,
          createdAt: 1,
          _id: 1,
          postId: 1,
          parentCommentId: 1,
        },
      },
      {
        $sort: sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Get all comments for this post to build the complete tree
    const allComments = await Comment.aggregate([
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          username: "$user.username",
          profileImage: "$user.profileImage",
          content: 1,
          createdAt: 1,
          _id: 1,
          postId: 1,
          parentCommentId: 1,
        },
      },
    ]);

    // Build the complete comment tree with sorting
    const buildCommentTree = (parentId = null, sortOrder = 1) => {
      const filteredComments = allComments.filter((comment) => {
        if (parentId === null) {
          return comment.parentCommentId === null;
        }
        return (
          comment.parentCommentId &&
          comment.parentCommentId.toString() === parentId.toString()
        );
      });

      // Sort the filtered comments
      const sortedComments = filteredComments.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return sortOrder === 1 ? dateA - dateB : dateB - dateA;
      });

      return sortedComments.map((comment) => ({
        ...comment,
        replies: buildCommentTree(comment._id, sortOrder),
      }));
    };

    // Determine sort order based on the sort parameter
    const sortOrder = sort === "oldest" ? 1 : -1; // 1 for ascending (oldest first), -1 for descending (newest first)
    console.log("Sort order determined:", sortOrder); // Debug log

    // Build the complete tree and then filter to only top-level comments
    const completeTree = buildCommentTree(null, sortOrder);
    const topLevelCommentsWithReplies = completeTree.filter((comment) =>
      topLevelComments.some(
        (topLevel) => topLevel._id.toString() === comment._id.toString()
      )
    );

    return res.status(200).json({
      comments: topLevelCommentsWithReplies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasMore: page * limit < totalComments,
      },
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// Helper function for deep nested replies (if needed)
const getNestedReplies = async (commentId, depth = 1, maxDepth = 3) => {
  if (depth > maxDepth) return [];

  const replies = await Comment.aggregate([
    {
      $match: {
        parentCommentId: new mongoose.Types.ObjectId(commentId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $project: {
        username: "$user.username",
        profileImage: "$user.profileImage",
        content: 1,
        createdAt: 1,
        _id: 1,
        parentCommentId: 1,
      },
    },
    {
      $sort: { createdAt: 1 },
    },
    {
      $limit: 50, // Limit replies per level
    },
  ]);

  // Recursively get nested replies
  for (let reply of replies) {
    reply.nestedReplies = await getNestedReplies(
      reply._id,
      depth + 1,
      maxDepth
    );
  }

  return replies;
};

const addPostView = async (req, res) => {
  const { postIds } = req.body;
  const userId = req.user.userId;

  if (!postIds || postIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Post IDs are required" });
  }

  try {
    // Track which posts are being viewed for the first time by this user
    const newViews = [];

    for (const postId of postIds) {
      // Check if user has already viewed this post
      if (postId) {
        const existingView = await PostView.findOne({ postId, userId });

        if (!existingView) {
          // Create new view record
          await PostView.create({ postId, userId });
          newViews.push(postId);
        }
      }
    }

    // Increment view count only for posts that were viewed for the first time
    if (newViews.length > 0) {
      await Post.updateMany({ _id: { $in: newViews } }, { $inc: { views: 1 } });
    }

    return res.status(200).json({
      success: true,
      message: "Post views added successfully",
      newViews: newViews.length,
      postIds: newViews,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createPost,
  getPosts,
  getPostByChannelId,
  // togglePostLike,
  getPostById,
  addComment,
  getComments,
  getNestedReplies,
  addPostView,
  deletePost,
};
