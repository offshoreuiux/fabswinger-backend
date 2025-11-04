const User = require("../models/user/UserSchema");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { s3, getS3KeyFromUrl } = require("../utils/s3");
const mongoose = require("mongoose");
const Friends = require("../models/FriendRequestSchema");
const Wink = require("../models/WinkSchema");
// const { getOnlineUsers: getOnlineUsersFromSocket } = require("../utils/socket");
const NotificationService = require("../services/notificationService");
const { sendMail } = require("../utils/transporter");
const { generateProfileWinkEmail } = require("../utils/emailTemplates");
const UserReview = require("../models/user/UserReviewScehema");
const SubscriptionSchema = require("../models/payment/SubscriptionSchema");
const PostWink = require("../models/post/PostWinkSchema");

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = { ...req.body };

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const sensitiveFields = [
      "password",
      "email",
      "username",
      "isVerified",
      "isActive",
      "role",
      "createdAt",
      "_id",
      "__v",
    ];

    sensitiveFields.forEach((field) => {
      delete updateData[field];
    });

    // Filter out empty strings for enum fields to prevent validation errors
    const enumFields = ["gender", "sexuality", "bodyType", "ethnicity"];
    enumFields.forEach((field) => {
      if (updateData[field] === "") {
        delete updateData[field];
      }
    });

    // Check if profile is being completed
    if (updateData.profileCompleted === true) {
      // Validate required fields for profile completion
      const requiredFields = ["nickname", "gender", "dateOfBirth"];
      const missingFields = requiredFields.filter(
        (field) => !updateData[field]
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }
    }

    // Add updatedAt timestamp
    updateData.updatedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ Update Profile API successful for userId: ${userId}`);

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Server error during profile update" });
  }
};

const updatePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Update Password API successful for userId: ${userId}`);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ error: "Server error during password update" });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sum of all winks received by this user
    const profileWinkAggregation = await Wink.aggregate([
      { $match: { winkedProfileId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);
    // Count winks on posts created by this user
    const postWinkAggregation = await PostWink.aggregate([
      {
        $lookup: {
          from: "posts", // Collection name for Post model
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: "$post" },
      { $match: { "post.userId": new mongoose.Types.ObjectId(userId) } },
      { $count: "total" },
    ]);
    const totalProfileWinks = profileWinkAggregation?.[0]?.total || 0;
    const totalPostWinks = postWinkAggregation?.[0]?.total || 0;
    const totalWinks = totalProfileWinks + totalPostWinks;

    const reviews = await UserReview.find({ reviewedId: userId })
      .populate("reviewerId", "username profileImage gender")
      .populate("reviewedId", "username profileImage gender")
      .sort({ createdAt: -1 });
    const reviewSummary = reviews.reduce((acc, review) => {
      acc[review.verificationType] = (acc[review.verificationType] || 0) + 1;
      return acc;
    }, {});
    const reviewDoneBy = reviews.reduce((acc, cur) => {
      acc[cur.reviewerId.gender] = (acc[cur.reviewerId.gender] || 0) + 1;
      return acc;
    }, {});
    const reviewDoneByData = {
      male: reviewDoneBy.man || 0,
      female: reviewDoneBy.woman || 0,
      couple:
        reviewDoneBy.coupleMF + reviewDoneBy.coupleMM + reviewDoneBy.coupleFF ||
        0,
    };
    const reviewSummaryData = {
      webcam: reviewSummary.webcam || 0,
      faceToFace: reviewSummary?.["face-to-face"] || 0,
      reviewDoneBy: reviewDoneByData,
    };

    const subscription = await SubscriptionSchema.findOne({
      userId: user._id,
    });

    const userWithWinkCount = {
      ...user.toObject(),
      winkCount: totalWinks,
      reviewSummary: reviewSummaryData,
      subscription: subscription || null,
    };

    console.log(`✅ Get Profile API successful for userId: ${user._id}`);

    res.json({ user: userWithWinkCount });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
};

const getProfiles = async (req, res) => {
  try {
    const {
      limit = 10,
      page = 1,
      lastId,
      search,
      gender,
      minAge,
      maxAge,
      location,
      filters,
    } = req.query;
    const loggedInUserId = req.user.userId;

    // Get current user's location coordinates for distance-based search
    const currentUser = await User.findById(loggedInUserId).select(
      "geoLocation"
    );
    const userCoordinates = currentUser?.geoLocation?.coordinates;

    // Get blocked users (both directions)
    const blockedUsers = await Friends.find({
      $or: [{ sender: loggedInUserId }, { receiver: loggedInUserId }],
      status: "blocked",
    });

    const blockedIds = blockedUsers.map((friendship) => {
      if (friendship.sender.toString() === loggedInUserId) {
        return friendship.receiver.toString();
      } else {
        return friendship.sender.toString();
      }
    });

    // Add current user, friends, and blocked users to exclusion list
    const excludeIds = [loggedInUserId, ...blockedIds];

    const query = {
      _id: { $nin: excludeIds },
      // isActive: true,
      // isVerified: true,
    };

    // Calculate skip for page-based pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Keep lastId support for backward compatibility
    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
    }

    if (search) {
      const regex = { $regex: search, $options: "i" };
      query.$or = [{ nickname: regex }, { username: regex }];
    }

    if (gender) {
      query.gender = gender;
    }

    // Remove the conflicting age filtering here since we handle it in the filters section

    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    if (filters) {
      const {
        whomYouAreLookingFor,
        whoWantsToMeet,
        agedBetween,
        withinDistance,
        smokers,
        interestedIn,
        ethnicity,
        onlyShowProfilesOf,
      } = JSON.parse(filters);

      if (whomYouAreLookingFor && whomYouAreLookingFor.length > 0) {
        query.gender = { $in: whomYouAreLookingFor };
      }
      if (whoWantsToMeet && whoWantsToMeet.length > 0) {
        query.lookingFor = { $in: whoWantsToMeet };
      }
      // Handle age filtering - prioritize agedBetween if provided, otherwise use minAge/maxAge
      if (agedBetween) {
        const [minAgeStr, maxAgeStr] = agedBetween.split("-");
        const minAge = parseInt(minAgeStr);
        const maxAge = parseInt(maxAgeStr);

        if (!isNaN(minAge) && !isNaN(maxAge)) {
          // Calculate date range for age filtering using dateOfBirth
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() - minAge);
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - maxAge);

          query.dateOfBirth = {
            $gte: minDate,
            $lte: maxDate,
          };
          console.log("Age filter applied:", {
            minAge,
            maxAge,
            minDate,
            maxDate,
          });
        }
      } else if (minAge || maxAge) {
        // Handle individual minAge/maxAge parameters
        query.dateOfBirth = {};
        if (minAge && !isNaN(parseInt(minAge))) {
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() - parseInt(minAge));
          query.dateOfBirth.$lte = maxDate;
          console.log("Min age filter applied:", { minAge, maxDate });
        }
        if (maxAge && !isNaN(parseInt(maxAge))) {
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - parseInt(maxAge));
          query.dateOfBirth.$gte = minDate;
          console.log("Max age filter applied:", { maxAge, minDate });
        }
      }
      // Only apply distance filtering if explicitly requested
      if (withinDistance && userCoordinates) {
        const distanceMiles = parseInt(withinDistance);
        if (!isNaN(distanceMiles)) {
          // Convert miles to meters (1 mile = 1609.34 meters)
          const distanceMeters = Math.round(distanceMiles * 1609.34);
          query.geoLocation = {
            $near: {
              $geometry: { type: "Point", coordinates: userCoordinates },
              $maxDistance: distanceMeters,
            },
          };
        }
      }
      if (smokers) {
        query.smoker = smokers === "smoker" ? true : false;
      }
      if (interestedIn && interestedIn.length > 0) {
        if (interestedIn.includes("Any")) {
          query.winkInterests = { $exists: true };
        } else {
          query.winkInterests = { $in: interestedIn };
        }
      }
      if (ethnicity) {
        query.ethnicity = ethnicity;
      }
      if (onlyShowProfilesOf === "verified") {
        query.isVerified = true;
      } else if (onlyShowProfilesOf === "accommodate") {
        query.openToAccommodate = true;
      } else if (onlyShowProfilesOf === "travel") {
        query.openToTravel = true;
      } else if (onlyShowProfilesOf === "new") {
        query.createdAt = {
          $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
        };
      }
    }

    // Only show profiles where profileVisibility is true
    query["settings.profileVisibility"] = true;
    query.role = "user";

    // Get total count for pagination info
    const totalCount = await User.countDocuments(query);

    const profiles = await User.find(query)
      .select("-password -email ")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get pending friend requests for each profile
    const profilesWithFriendRequests = await Promise.all(
      profiles.map(async (profile) => {
        // Check for pending friend requests between logged-in user and this profile
        const pendingRequest = await Friends.findOne({
          $or: [
            {
              sender: loggedInUserId,
              receiver: profile._id,
              status: "pending",
            },
            {
              sender: profile._id,
              receiver: loggedInUserId,
              status: "pending",
            },
          ],
        });

        // Add friend request details to profile
        const profileWithRequest = profile.toObject();
        if (pendingRequest) {
          profileWithRequest.friendRequest = {
            id: pendingRequest._id,
            status: pendingRequest.status,
            isSentByMe: pendingRequest.sender.toString() === loggedInUserId,
            sentAt: pendingRequest.createdAt,
          };
        } else {
          profileWithRequest.friendRequest = null;
        }

        // Check if the user and this profile are already friends
        const acceptedFriendship = await Friends.findOne({
          $or: [
            { sender: loggedInUserId, receiver: profile._id },
            { sender: profile._id, receiver: loggedInUserId },
          ],
          status: "accepted",
        });
        profileWithRequest.isFriend = Boolean(acceptedFriendship);
        const subscription = await SubscriptionSchema.findOne({
          userId: profile._id,
        });
        profileWithRequest.subscription = subscription || null;

        return profileWithRequest;
      })
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const currentPage = parseInt(page);

    console.log(
      `✅ Get Profiles API successful - returned ${profilesWithFriendRequests.length} profiles`
    );

    res.json({
      profiles: profilesWithFriendRequests,
      total: totalCount,
      currentPage: currentPage,
      totalPages: totalPages,
      hasMore: parseInt(limit) === profilesWithFriendRequests.length,
      limit: parseInt(limit),
    });
  } catch (error) {
    console.log("Error fetching profile list:", error);
    res.status(500).json({ error: "Server error while fetching profile list" });
  }
};

// Get profile by ID (for viewing other users)
const getProfileById = async (req, res) => {
  console.log("this functiion is invoked ");

  try {
    const { id } = req.params;
    const loggedInUserId = req.user.userId;

    const user = await User.findById(id).select("-password -email");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.settings.profileVisibility && user.id !== loggedInUserId) {
      return res
        .status(404)
        .json({ error: "User's profile is hidden", hidden: true });
    }

    // Check for pending friend requests between logged-in user and this profile
    const friendRequest = await Friends.findOne({
      $or: [
        { sender: loggedInUserId, receiver: id },
        { sender: id, receiver: loggedInUserId },
      ],
    });

    // Add friend request details to user profile
    const userWithRequest = user.toObject();
    if (friendRequest) {
      userWithRequest.friendRequest = {
        id: friendRequest._id,
        status: friendRequest.status,
        isSentByMe: friendRequest.sender.toString() === loggedInUserId,
        sentAt: friendRequest.createdAt,
      };
    } else {
      userWithRequest.friendRequest = null;
    }
    if (user.settings.reviewVisibility) {
      const reviews = await UserReview.find({ reviewedId: id })
        .populate("reviewerId", "username profileImage gender")
        .populate("reviewedId", "username profileImage gender")
        .sort({ createdAt: -1 });
      const reviewSummary = reviews.reduce((acc, review) => {
        acc[review.verificationType] = (acc[review.verificationType] || 0) + 1;
        return acc;
      }, {});
      const reviewDoneBy = reviews.reduce((acc, cur) => {
        acc[cur.reviewerId.gender] = (acc[cur.reviewerId.gender] || 0) + 1;
        return acc;
      }, {});
      const reviewDoneByData = {
        male: reviewDoneBy.man || 0,
        female: reviewDoneBy.woman || 0,
        couple:
          reviewDoneBy.coupleMF +
            reviewDoneBy.coupleMM +
            reviewDoneBy.coupleFF || 0,
      };
      const reviewSummaryData = {
        webcam: reviewSummary.webcam || 0,
        faceToFace: reviewSummary?.["face-to-face"] || 0,
        reviewDoneBy: reviewDoneByData,
      };

      userWithRequest.reviewSummary = reviewSummaryData;
    }

    const subscription = await SubscriptionSchema.findOne({
      userId: user._id,
    });
    userWithRequest.subscription = subscription || null;

    console.log(`✅ Get Profile By ID API successful for userId : ${id}`);

    res.json({ user: userWithRequest });
  } catch (error) {
    console.log("error111");

    console.error("Get profile by ID error:", error);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
};

const getPublicProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -email");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.settings.nonMemberVisibility) {
      return res.status(404).json({ error: "User has his profile hidden" });
    }
    console.log(`✅ Get Public Profile By ID API successful for userId: ${id}`);
    res.json({ user });
  } catch (error) {
    console.error("Get public profile by ID error:", error);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
};

// Update profile images
const updateProfileImage = async (req, res) => {
  try {
    const userId = req.user.userId;
    let url;

    if (!req.file) {
      return res.status(400).json({ error: "Avatar is required" });
    }

    const file = req.file;
    const fileName = `avatars/${uuidv4()}-${file.originalname}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const uploadResult = await s3.upload(params).promise();
    url = uploadResult.Location;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profileImage: url,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ Update Profile Image API successful for userId: ${userId}`);

    res.json({
      message: "Profile image updated successfully",
      profileImage: updatedUser.profileImage,
    });
  } catch (error) {
    console.error("Update profile image error:", error);
    res.status(500).json({ error: "Server error during image update" });
  }
};

// Delete profile image
const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.profileImage) {
      const key = getS3KeyFromUrl(user.profileImage);
      await s3
        .deleteObject({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
        })
        .promise();
      user.profileImage = "";
      user.updatedAt = new Date();
      await user.save();

      console.log(
        `✅ Delete Profile Image API successful for userId: ${userId}`
      );

      res.json({
        message: "Image deleted successfully",
        profileImage: user.profileImage,
      });
    } else {
      return res.status(400).json({ error: "No image to delete" });
    }
  } catch (error) {
    console.error("Delete profile image error:", error);
    res.status(500).json({ error: "Server error during image deletion" });
  }
};

const updateLocation = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }

    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
        received: { latitude, longitude },
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.geoLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    await user.save();
    console.log(`✅ Update Location API successful for userId: ${userId}`);
    res.json({
      message: "Location updated successfully",
      geoLocation: user.geoLocation,
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ error: "Server error during location update" });
  }
};

const updateProfileSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { setting, value } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const newSettings = { ...user.settings, [setting]: value };
    user.settings = newSettings;
    await user.save();
    console.log(
      `✅ Update Profile Settings API successful for userId: ${userId}`
    );
    res.json({
      message: "Profile settings updated successfully",
      settings: newSettings,
    });
  } catch (error) {
    console.error("Update profile settings error:", error);
    res
      .status(500)
      .json({ error: "Server error during profile settings update" });
  }
};

const winkProfile = async ({ profileId, userId, io }) => {
  try {
    const user = await User.findById(profileId);
    if (!user) {
      return { error: "User not found" };
    }

    // Check if a wink already exists
    let wink = await Wink.findOne({
      winkerId: userId,
      winkedProfileId: profileId,
    });

    if (wink) {
      // If exists, increment count
      wink.count += 1;
      await wink.save();
    } else {
      // If not, create new
      wink = await Wink.create({
        winkerId: userId,
        winkedProfileId: profileId,
        count: 1,
      });
    }
    await NotificationService.createProfileWinkNotification(userId, profileId);
    if (user?.settings?.getWinks) {
      const mailOptions = {
        to: user.email,
        subject: "New Wink",
        html: generateProfileWinkEmail(userId, profileId),
        from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
      };
      await sendMail(mailOptions);
    }

    // Emit real-time wink count update to the winked user
    if (io) {
      // Get updated total wink count for the winked user
      const profileWinkAggregation = await Wink.aggregate([
        { $match: { winkedProfileId: new mongoose.Types.ObjectId(profileId) } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]);
      const postWinkAggregation = await PostWink.aggregate([
        {
          $lookup: {
            from: "posts", // Collection name for Post model
            localField: "postId",
            foreignField: "_id",
            as: "post",
          },
        },
        { $unwind: "$post" },
        { $match: { "post.userId": new mongoose.Types.ObjectId(profileId) } },
        { $count: "total" },
      ]);
      const totalProfileWinks = profileWinkAggregation?.[0]?.total || 0;
      const totalPostWinks = postWinkAggregation?.[0]?.total || 0;
      const totalWinks = totalProfileWinks + totalPostWinks;

      io.to(`user-${profileId}`).emit("wink-count-update", {
        userId: profileId,
        winkCount: totalWinks,
      });
    }

    return { message: "Profile winked successfully", wink };
  } catch (error) {
    console.error("Error in winkProfile:", error);
    return { error: "Internal server error" };
  }
};

const getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = await User.countDocuments({ isOnline: true });
    // const onlineUsers = 1;
    console.log("onlineUsers", onlineUsers);
    console.log(`✅ Get Online Users API successful - count: ${onlineUsers}`);
    res.json({ onlineUsers });
  } catch (error) {
    console.error("Error in getOnlineUsers:", error);
    res.status(500).json({ error: "Server error while fetching online users" });
  }
};

const createUserReview = async (req, res) => {
  try {
    const { reviewedId, review, verificationType } = req.body;
    const reviewerId = req.user.userId;
    if (!reviewedId || !review || !verificationType) {
      return res.status(400).json({
        error: "Reviewed ID, review and verification type are required",
      });
    }
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) {
      return res.status(404).json({ error: "Reviewer not found" });
    }
    const reviewed = await User.findById(reviewedId);
    if (!reviewed) {
      return res.status(404).json({ error: "Reviewed not found" });
    }
    if (reviewer.id === reviewed.id) {
      return res
        .status(400)
        .json({ error: "You cannot review your own profile" });
    }
    const userReview = await UserReview.create({
      reviewerId,
      reviewedId,
      review,
      verificationType,
    });
    try {
      // Notify the reviewed user via service helper
      await NotificationService.createUserReviewNotification(
        reviewerId,
        reviewedId,
        userReview._id
      );
    } catch (notifyErr) {
      console.error("Failed to create review notification:", notifyErr);
      // Do not fail the request if notification fails
    }

    const reviewData = await UserReview.findById(userReview._id)
      .populate("reviewerId", "username profileImage")
      .populate("reviewedId", "username profileImage");

    console.log(
      `✅ Create User Review API successful - reviewerId: ${reviewerId}, reviewedId: ${reviewedId}`
    );

    res.status(201).json({
      message: "User review created successfully",
      review: reviewData,
      success: true,
    });
  } catch (error) {
    console.error("Error in createUserReview:", error);
    res.status(500).json({
      error: "Server error while creating user review",
      message: error.message,
    });
  }
};

const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId; // Get the current user making the request

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const allReviews = await UserReview.find({ reviewedId: userId })
      .populate("reviewerId", "username profileImage settings")
      .populate("reviewedId", "username profileImage settings")
      .sort({ createdAt: -1 });

    // Filter out reviews from users with hidden profiles
    const userReviews = allReviews.filter((review) => {
      const reviewer = review.reviewerId;

      // If reviewer doesn't exist or is deleted, exclude the review
      if (!reviewer) {
        return false;
      }

      // Allow current user to see their own reviews
      if (currentUserId && reviewer._id.toString() === currentUserId) {
        return true;
      }

      // Exclude reviews from users with hidden profiles
      if (reviewer.settings?.profileVisibility === false) {
        return false;
      }

      return true;
    });

    console.log("userReviews", userReviews.length);
    console.log(
      `✅ Get User Reviews API successful for userId: ${userId} - returned ${userReviews.length} reviews (filtered from ${allReviews.length})`
    );
    res.status(200).json({ userReviews });
  } catch (error) {
    console.error("Error in getUserReviews:", error);
    res.status(500).json({ error: "Server error while fetching user reviews" });
  }
};

const hideProfile = async (req, res) => {};

module.exports = {
  updateProfile,
  updatePassword,
  getProfile,
  getProfiles,
  getProfileById,
  getPublicProfileById,
  updateProfileImage,
  deleteProfileImage,
  updateLocation,
  updateProfileSettings,
  winkProfile,
  getOnlineUsers,
  createUserReview,
  getUserReviews,
  hideProfile,
};
