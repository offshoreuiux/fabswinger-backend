const Post = require("../models/post/PostSchema");
const PostLike = require("../models/post/PostLikeSchema");
const PostWink = require("../models/post/PostWinkSchema");
const PostHotlist = require("../models/post/PostHotlistSchema");
const { v4: uuidv4 } = require("uuid");
const { s3, getS3KeyFromUrl } = require("../utils/s3");
const mongoose = require("mongoose");
const NotificationService = require("../services/notificationService");
const User = require("../models/UserSchema");
const Friends = require("../models/FriendRequestSchema");
const { getIO } = require("../utils/socket");

const createPost = async (req, res) => {
  try {
    const { caption, privacy = "public", location } = req.body;
    const userId = req.user.userId; // Fixed: should be req.user.userId
    const uploadedImageUrls = [];

    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const fileName = `posts/${uuidv4()}-${file.originalname}`;

        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const uploadResult = await s3.upload(params).promise();
        uploadedImageUrls.push(uploadResult.Location); // public URL
      }
    }

    const parsedLocation =
      typeof location === "string" ? JSON.parse(location) : location;

    const post = await Post.create({
      caption,
      images: uploadedImageUrls,
      privacy,
      userId,
      location: parsedLocation,
    });

    // Populate user details before sending response
    const populatedPost = await Post.findById(post._id)
      .populate("userId", "username profileImage nickname")
      .lean();

    res.status(201).json(populatedPost);
  } catch (error) {
    console.log("Error in createPost:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Function to get posts with base64 images - OLD VERSION (COMMENTED)
/*
const getPosts = async (req, res) => {
  try {
    const {
      privacy,
      userId,
      latitude,
      longitude,
      radius = 10,
      lastPostId,
      limit = 20,
    } = req.query;
    const currentUserId = req.user.userId;
    const currentUserIdObj = new mongoose.Types.ObjectId(currentUserId);

    let query = {};

    // If filtering by a specific user
    if (userId) {
      query.userId = userId;

      if (privacy === "private") {
        // Only allow private posts if currentUserId === userId
        if (currentUserId === userId) {
          query.privacy = "private";
        } else {
          return res
            .status(403)
            .json({ error: "Unauthorized to view private posts of this user" });
        }
      } else if (privacy === "public") {
        query.privacy = "public";
      } else {
        // No privacy param — return public posts only unless it's the current user's own profile
        query.privacy =
          currentUserId === userId ? { $in: ["public", "private"] } : "public";
      }
    } else {
      // No userId filter — return public + current user's private posts
      if (privacy === "private") {
        query = {
          userId: currentUserIdObj,
          privacy: "private",
        };
      } else if (privacy === "public") {
        query = { privacy: "public" };
      } else {
        query = {
          $or: [
            { privacy: "public" },
            { userId: currentUserIdObj, privacy: "private" },
          ],
        };
      }
    }

    // Track if we need geospatial query
    let hasLocationFilter = false;
    let locationParams = null;

    // Add location-based filtering if coordinates are provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusKm = parseFloat(radius);

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        hasLocationFilter = true;
        locationParams = {
          lat,
          lng,
          radiusKm,
          maxDistance: radiusKm * 1000,
        };
      }
    }

    if (lastPostId && mongoose.Types.ObjectId.isValid(lastPostId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(lastPostId) };
    }

    // Build aggregation pipeline
    let pipeline = [];

    // If we have location filter, start with $geoNear
    if (hasLocationFilter) {
      console.log("hasLocationFilter=======", hasLocationFilter);
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [locationParams.lng, locationParams.lat],
          },
          distanceField: "distance",
          maxDistance: locationParams.maxDistance,
          spherical: true,
          query: query,
        },
      });
    } else {
      // Regular $match for non-geospatial queries
      pipeline.push({ $match: query });
    }

    // Add the rest of the pipeline
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                nickname: 1,
                profileImage: 1,
                verified: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "postwinks",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userWink",
        },
      },
      {
        $lookup: {
          from: "postlikes",
          localField: "_id",
          foreignField: "postId",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "postlikes",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userLike",
        },
      },
      {
        $lookup: {
          from: "posthotlists",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userHotlist",
        },
      },
      {
        $addFields: {
          userId: { $arrayElemAt: ["$userInfo", 0] },
          likes: { $size: "$likes" },
          isLiked: { $gt: [{ $size: "$userLike" }, 0] },
          isWinked: { $gt: [{ $size: "$userWink" }, 0] },
          isHotlisted: { $gt: [{ $size: "$userHotlist" }, 0] },
        },
      },
      {
        $project: {
          userInfo: 0,
          userLike: 0,
          userWink: 0,
          userHotlist: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: parseInt(limit) }
    );

    // Use aggregation to get posts with like count and user like status
    const posts = await Post.aggregate(pipeline);
    console.log("posts", posts);

    res.json(posts);
  } catch (error) {
    console.error("Error in getPosts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
*/

// Function to get posts with base64 images - NEW VERSION (with friend access to private posts)
const getPosts = async (req, res) => {
  try {
    const {
      privacy,
      userId,
      latitude,
      longitude,
      radius = 10,
      limit = 20,
      tab,
      page = 1,
    } = req.query;
    const currentUserId = req.user.userId;
    const currentUserIdObj = new mongoose.Types.ObjectId(currentUserId);

    const skip = (page - 1) * limit;

    // First, get the current user's friends list
    const currentUser = await User.findById(currentUserId);
    const userFriends = await Friends.find({
      $or: [{ sender: currentUserIdObj }, { receiver: currentUserIdObj }],
      status: "accepted",
    });
    const userFriendsObjIds = userFriends.map((friend) => {
      // Convert both to strings for comparison
      const receiverStr = friend?.receiver?.toString();
      const senderStr = friend?.sender?.toString();
      const currentUserIdStr = currentUserIdObj.toString();

      // Return the other user's ID (not the current user's ID)
      return receiverStr === currentUserIdStr
        ? friend?.sender
        : friend?.receiver;
    });

    let query = {};

    // Handle different tabs first
    if (tab === "hotlists") {
      // For hotlists tab, get posts that the current user has hotlisted
      const userHotlistedPosts = await PostHotlist.find({
        userId: currentUserIdObj,
      })
        .select("postId")
        .lean();

      if (userHotlistedPosts.length === 0) {
        // If user has no hotlisted posts, return empty array
        console.log("User has no hotlisted posts, returning empty posts array");
        return res.json({ posts: [], hasMore: false });
      }

      const hotlistedPostIds = userHotlistedPosts.map((hp) => hp.postId);
      query._id = { $in: hotlistedPostIds };

      // For hotlisted posts, we want to show them regardless of privacy settings
      // since the user has explicitly saved them
      query.privacy = { $in: ["public", "private"] };
    } else if (tab === "friends") {
      // For friends tab, only show posts from friends (both public and private)
      if (userFriendsObjIds.length === 0) {
        // If user has no friends, return empty array
        console.log("User has no friends, returning empty posts array");
        return res.json({ posts: [], hasMore: false });
      }

      query = {
        userId: { $in: userFriendsObjIds },
        privacy: { $in: ["public", "private"] },
      };
    } else {
      // Default behavior for "All" tab or no tab specified
      // If filtering by a specific user
      if (userId) {
        query.userId = userId;

        if (privacy === "private") {
          // Allow private posts if currentUserId === userId OR if current user is friends with the post owner
          if (
            currentUserId === userId ||
            userFriendsObjIds.some((friendId) => friendId.toString() === userId)
          ) {
            query.privacy = "private";
          } else {
            return res.status(403).json({
              error: "Unauthorized to view private posts of this user",
            });
          }
        } else if (privacy === "public") {
          query.privacy = "public";
        } else {
          // No privacy param — return public posts + private posts if user is owner or friend
          if (
            currentUserId === userId ||
            userFriendsObjIds.some((friendId) => friendId.toString() === userId)
          ) {
            query.privacy = { $in: ["public", "private"] };
          } else {
            query.privacy = "public";
          }
        }
      } else {
        // No userId filter — return public + current user's private posts + friends' private posts
        if (privacy === "private") {
          query = {
            $or: [
              { userId: currentUserIdObj, privacy: "private" },
              {
                userId: { $in: userFriendsObjIds },
                privacy: "private",
              },
            ],
          };
        } else if (privacy === "public") {
          query = { privacy: "public" };
        } else {
          query = {
            $or: [
              { privacy: "public" },
              { userId: currentUserIdObj, privacy: "private" },
              {
                userId: { $in: userFriendsObjIds },
                privacy: "private",
              },
            ],
          };
        }
      }
    }

    // Track if we need geospatial query
    let hasLocationFilter = false;
    let locationParams = null;

    // Add location-based filtering if coordinates are provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusKm = parseFloat(radius);

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        hasLocationFilter = true;
        locationParams = {
          lat,
          lng,
          radiusKm,
          maxDistance: radiusKm * 1000,
        };
      }
    }

    // Build aggregation pipeline
    let pipeline = [];

    // If we have location filter, start with $geoNear
    if (hasLocationFilter) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [locationParams.lng, locationParams.lat],
          },
          distanceField: "distance",
          maxDistance: locationParams.maxDistance,
          spherical: true,
          query: query,
        },
      });
    } else {
      // Regular $match for non-geospatial queries
      pipeline.push({ $match: query });
    }

    // Add the rest of the pipeline
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
          pipeline: [
            {
              $project: {
                username: 1,
                nickname: 1,
                profileImage: 1,
                verified: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "postwinks",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userWink",
        },
      },
      {
        $lookup: {
          from: "postlikes",
          localField: "_id",
          foreignField: "postId",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "postlikes",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userLike",
        },
      },
      {
        $lookup: {
          from: "posthotlists",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    {
                      $eq: [
                        "$userId",
                        new mongoose.Types.ObjectId(currentUserId),
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "userHotlist",
        },
      },
      {
        $addFields: {
          userId: { $arrayElemAt: ["$userInfo", 0] },
          likes: { $size: "$likes" },
          isLiked: { $gt: [{ $size: "$userLike" }, 0] },
          isWinked: { $gt: [{ $size: "$userWink" }, 0] },
          isHotlisted: { $gt: [{ $size: "$userHotlist" }, 0] },
        },
      },
      {
        $project: {
          userInfo: 0,
          userLike: 0,
          userWink: 0,
          userHotlist: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) }
    );

    // Use aggregation to get posts with like count and user like status
    const posts = await Post.aggregate(pipeline);
    console.log(`Retrieved ${posts.length} posts for tab: ${tab || "All"}`);

    // Calculate hasMore by checking if we got the full limit
    const hasMore = posts.length === parseInt(limit);

    res.status(200).json({ posts, hasMore });
  } catch (error) {
    console.error("Error in getPosts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    const post = await Post.findOne({ _id: postId });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this post" });
    }

    if (post.images.length > 0) {
      await Promise.all(
        post.images.map(async (image) => {
          const key = getS3KeyFromUrl(image);
          console.log("Deleting image", key);
          await s3
            .deleteObject({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: key,
            })
            .promise();
        })
      );
    }

    await Promise.all([
      Post.findByIdAndDelete(postId),
      PostLike.deleteMany({ postId }),
      PostWink.deleteMany({ postId }),
      PostHotlist.deleteMany({ postId }),
    ]);

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.log("Error deleting post");
    res.status(500).json({ error: "Internal server error" });
  }
};

const likePost = async ({ postId, userId, io: socketIo }) => {
  try {
    // Check if post exists
    console.log("postId", postId);
    console.log("userId", userId);
    const post = await Post.findById(postId);
    if (!post) {
      return { error: "Post not found" };
    }

    // Check if user already liked the post
    const existingLike = await PostLike.findOne({ postId, userId });
    if (existingLike) {
      return { error: "Post already liked" };
    }

    // Create new like
    const like = await PostLike.create({ postId, userId });

    // Get updated like count
    const likeCount = await PostLike.countDocuments({ postId });

    // Create notification for post owner
    try {
      await NotificationService.createPostLikeNotification(
        userId,
        post.userId,
        postId
      );
    } catch (notificationError) {
      console.error("Error creating like notification:", notificationError);
      // Don't fail the request if notification fails
    }

    // Emit socket event for real-time updates
    // Use provided socketIo or fallback to getIO()
    let io;
    try {
      io = socketIo || getIO();
    } catch (error) {
      console.warn("Socket not available for likePost:", error.message);
    }

    if (io) {
      io.emit("post-liked", {
        postId,
        userId,
        likeCount,
        isLiked: true,
      });
    }

    return {
      message: "Post liked successfully",
      like,
      likeCount,
      isLiked: true,
    };
  } catch (error) {
    console.error("Error in likePost:", error);
    return { error: "Internal server error" };
  }
};

const unlikePost = async ({ postId, userId, io: socketIo }) => {
  try {
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return { error: "Post not found" };
    }

    // Remove like
    const deletedLike = await PostLike.findOneAndDelete({ postId, userId });
    if (!deletedLike) {
      return { error: "Post not liked" };
    }

    // Get updated like count
    const likeCount = await PostLike.countDocuments({ postId });

    // Emit socket event for real-time updates
    // Use provided socketIo or fallback to getIO()
    let io;
    try {
      io = socketIo || getIO();
    } catch (error) {
      console.warn("Socket not available for unlikePost:", error.message);
    }

    if (io) {
      io.emit("post-unliked", {
        postId,
        userId,
        likeCount,
        isLiked: false,
      });
    }

    return {
      message: "Post unliked successfully",
      likeCount,
      isLiked: false,
    };
  } catch (error) {
    console.error("Error in unlikePost:", error);
    return { error: "Internal server error" };
  }
};

const winkPost = async ({ postId, userId, io: socketIo }) => {
  try {
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return { error: "Post not found" };
    }

    // Check if user already liked the post
    const existingWink = await PostWink.findOne({ postId, userId });
    if (existingWink) {
      return { error: "Post already winked" };
    }

    // Create new like
    const wink = await PostWink.create({ postId, userId });
    console.log("wink", wink);

    // Get updated like count
    const winkCount = await PostWink.countDocuments({ postId });

    // Emit socket event for real-time updates
    // if (io) {
    //   io.emit("post-winked", {
    //     postId,
    //     userId,
    //     winkCount,
    //     isWinked: true,
    //   });
    // }

    return {
      message: "Post winked successfully",
      wink,
      winkCount,
      isWinked: true,
    };
  } catch (error) {
    console.error("Error in winkPost:", error);
    return { error: "Internal server error" };
  }
};

const unwinkPost = async ({ postId, userId, io: socketIo }) => {
  try {
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return { error: "Post not found" };
    }

    // Remove like
    const deletedWink = await PostWink.findOneAndDelete({ postId, userId });
    if (!deletedWink) {
      return { error: "Post not winked" };
    }

    // Get updated like count
    const winkCount = await PostWink.countDocuments({ postId });

    // Emit socket event for real-time updates
    // const io = getIO();
    // if (io) {
    //   io.emit("post-unwinked", {
    //     postId,
    //     userId,
    //     winkCount,
    //     isWinked: false,
    //   });
    // }

    return {
      message: "Post unwinked successfully",
      winkCount,
      isWinked: false,
    };
  } catch (error) {
    console.error("Error in unwinkPost:", error);
    return { error: "Internal server error" };
  }
};

const hotlistPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user already hotlisted the post
    const existingHotlist = await PostHotlist.findOne({ postId, userId });
    if (existingHotlist) {
      return res.status(400).json({ error: "Post already hotlisted" });
    }

    // Create new hotlist
    const hotlist = await PostHotlist.create({ postId, userId });

    // Get updated like count
    const hotlistCount = await PostHotlist.countDocuments({ postId });

    // Emit socket event for real-time updates
    // const io = req.app.get("io");
    // if (io) {
    //   io.emit("post-unwinked", {
    //     postId,
    //     userId,
    //     winkCount,
    //     isWinked: false,
    //   });
    // }

    res.json({
      message: "Post hotlisted successfully",
      hotlist,
      hotlistCount,
      isHotlisted: true,
    });
  } catch (error) {
    console.error("Error in hotlistPost:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unhotlistPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Remove like
    const deletedHotlist = await PostHotlist.findOneAndDelete({
      postId,
      userId,
    });
    if (!deletedHotlist) {
      return res.status(400).json({ error: "Post not hotlisted" });
    }

    // Get updated like count
    const hotlistCount = await PostHotlist.countDocuments({ postId });

    // Emit socket event for real-time updates
    // const io = req.app.get("io");
    // if (io) {
    //   io.emit("post-unwinked", {
    //     postId,
    //     userId,
    //     winkCount,
    //     isWinked: false,
    //   });
    // }

    res.json({
      message: "Post unhotlisted successfully",
      hotlistCount,
      isHotlisted: false,
    });
  } catch (error) {
    console.error("Error in unhotlistPost:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPostsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const posts = await Post.find({ userId }).lean();
    // Separate media by inferring type from file extension in image URLs
    // Treat common video extensions as videos; everything else stays as images
    const videoExtensions = [
      ".mp4",
      ".mov",
      ".avi",
      ".mkv",
      ".webm",
      ".m4v",
      ".3gp",
    ];

    const images = [];
    const videos = [];

    for (const post of posts) {
      const mediaUrls = Array.isArray(post.images) ? post.images : [];
      const hasAnyVideo = mediaUrls.some((url) => {
        try {
          const lower = String(url).toLowerCase();
          return videoExtensions.some((ext) => lower.endsWith(ext));
        } catch (_) {
          return false;
        }
      });

      if (hasAnyVideo) {
        videos.push(post);
      } else if (mediaUrls.length > 0) {
        images.push(post);
      }
    }

    res.json({ message: "Posts fetched successfully", images, videos });
  } catch (error) {
    console.error("Error in getPostsByUserId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createPost,
  getPosts,
  deletePost,
  likePost,
  unlikePost,
  winkPost,
  unwinkPost,
  hotlistPost,
  unhotlistPost,
  getPostsByUserId,
};
