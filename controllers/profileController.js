const User = require("../models/UserSchema");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const s3 = require("../utils/s3");
const mongoose = require("mongoose");
const Friends = require("../models/FriendRequestSchema");

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.email;
    delete updateData.username;
    delete updateData.isVerified;
    delete updateData.isActive;

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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select("-password");

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
    } = req.query;
    const loggedInUserId = req.user.userId;

    // Get the current user's friend IDs (both sent and received)
    const userFriendships = await Friends.find({
      $or: [{ sender: loggedInUserId }, { receiver: loggedInUserId }],
      status: { $in: ["accepted", "pending"] }, // Include both accepted and pending requests
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

    if (minAge || maxAge) {
      query.dateOfBirth = {};
      if (minAge) {
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() - parseInt(minAge));
        query.dateOfBirth.$lte = maxDate;
      }
      if (maxAge) {
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - parseInt(maxAge));
        query.dateOfBirth.$gte = minDate;
      }
    }

    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    const profiles = await User.find(query)
      .select("-password -email ")
      .sort({ _id: -1 })
      .limit(parseInt(limit));

    res.json({
      profiles,
      total: profiles.length,
      hasMore: profiles.length === parseInt(limit),
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

    const user = await User.findById(id).select("-password -email");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get profile by ID error:", error);
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
    const { imageUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove the image from the array
    user.profileImages = user.profileImages.filter(
      (img) => img.url !== imageUrl
    );
    user.updatedAt = new Date();
    await user.save();

    res.json({
      message: "Image deleted successfully",
      profileImages: user.profileImages,
    });
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

module.exports = {
  updateProfile,
  updatePassword,
  getProfile,
  getProfiles,
  getProfileById,
  updateProfileImage,
  deleteProfileImage,
  updateLocation,
};
