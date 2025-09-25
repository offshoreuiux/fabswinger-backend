const User = require("../models/UserSchema");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { s3, getS3KeyFromUrl } = require("../utils/s3");
const mongoose = require("mongoose");
const Friends = require("../models/FriendRequestSchema");
const Wink = require("../models/WinkSchema");
const NotificationService = require("../services/notificationService");

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

    res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Server error while fetching profile" });
  }
};

const getProfiles = async (req, res) => {
  try {
    const {
      limit = 10,
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

    // Get the current user's friend IDs (both sent and received)
    const userFriendships = await Friends.find({
      $or: [{ sender: loggedInUserId }, { receiver: loggedInUserId }],
      status: { $in: ["accepted"] }, // Include both accepted and pending requests
    });

    // Extract friend IDs from friendships
    const friendIds = userFriendships.map((friendship) => {
      if (friendship.sender.toString() === loggedInUserId) {
        return friendship.receiver.toString();
      } else {
        return friendship.sender.toString();
      }
    });

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
    const excludeIds = [loggedInUserId, ...friendIds, ...blockedIds];

    const query = {
      _id: { $nin: excludeIds },
      // isActive: true,
      // isVerified: true,
    };

    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
    }

    if (search) {
      query.nickname = { $regex: search, $options: "i" };
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
        query.lookingFor = { $in: whomYouAreLookingFor };
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

    const profiles = await User.find(query)
      .select("-password -email ")
      .sort({ _id: -1 })
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

        return profileWithRequest;
      })
    );

    res.json({
      profiles: profilesWithFriendRequests,
      total: profilesWithFriendRequests.length,
      hasMore: profilesWithFriendRequests.length === parseInt(limit),
    });
  } catch (error) {
    console.log("Error fetching profile list:", error);
    res.status(500).json({ error: "Server error while fetching profile list" });
  }
};

// Get profile by ID (for viewing other users)
const getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUserId = req.user.userId;

    const user = await User.findById(id).select("-password -email");

    if (!user || !user.settings.profileVisibility) {
      return res.status(404).json({ error: "User not found" });
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

    res.json({ user: userWithRequest });
  } catch (error) {
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
    if (user?.settings?.getWinks) {
      await NotificationService.createProfileWinkNotification(
        userId,
        profileId
      );
    }

    return { message: "Profile winked successfully", wink };
  } catch (error) {
    console.error("Error in winkProfile:", error);
    return { error: "Internal server error" };
  }
};

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
};
