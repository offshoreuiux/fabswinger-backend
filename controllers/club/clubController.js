const Club = require("../../models/club/ClubSchema");
const User = require("../../models/UserSchema");
const { s3 } = require("../../utils/s3");
const { v4: uuidv4 } = require("uuid");
const Event = require("../../models/event/EventSchema");
const Meet = require("../../models/meet/MeetSchema");
const ClubReview = require("../../models/club/ClubReviewSchema");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const createClub = async (req, res) => {
  try {
    const {
      name,
      region,
      description,
      url,
      location,
      clubEmail,
      phone,
      people,
      isOwner,
    } = req.body;
    const owner = req.user.userId;
    const image = req.file;

    if (
      !name ||
      !region ||
      !url ||
      !clubEmail ||
      !people ||
      !description ||
      !location ||
      !phone ||
      !image
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const fileName = `clubs/${uuidv4()}-${image.originalname}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: image.buffer,
      ContentType: image.mimetype,
    };
    const uploadResult = await s3.upload(params).promise();
    const imageUrl = uploadResult.Location;

    let geoLocation = null;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          location
        )}&format=json&addressdetails=1&limit=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const geoData = await geoRes.json();
      console.log("geoData", geoData);
      if (geoData.length > 0) {
        console.log("geoData", geoData);

        // Extract coordinates for geospatial queries
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        if (!isNaN(lat) && !isNaN(lon)) {
          geoLocation = {
            type: "Point",
            coordinates: [lon, lat], // [longitude, latitude]
          };
          console.log("Coordinates extracted:", { lat, lon, geoLocation });
        }
      }
    } catch (geoErr) {
      console.error("Geocoding error:", geoErr.message);
    }

    const club = new Club({
      name,
      region,
      description,
      url,
      location,
      geoLocation,
      clubEmail,
      phone,
      people,
      image: imageUrl,
      owner,
    });

    await club.save();

    res.status(201).json({ message: "Club created successfully", club: club });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create club", error: error.message });
  }
};

const getClubs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      location = "",
      region: regionSearch = "",
      filter = {},
    } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.userId;
    const { type, region, distance, discover, sort } = JSON.parse(filter);

    const query = {};

    if (type) query.type = type;
    if (region) query.region = region;

    // Handle distance filter with geoWithin
    if (distance && distance !== "all") {
      const currentUser = await User.findById(userId).select("geoLocation");
      const userCoordinates = currentUser?.geoLocation?.coordinates;

      if (userCoordinates) {
        let maxDistance = 0;
        if (distance === "0-25") maxDistance = 25;
        else if (distance === "25-50") maxDistance = 50;
        else if (distance === "50-75") maxDistance = 75;
        else if (distance === "75-100") maxDistance = 100;
        else if (distance === "100-150") maxDistance = 150;

        if (maxDistance > 0) {
          const distanceMeters = Math.round(maxDistance * 1609.34);
          query.geoLocation = {
            $geoWithin: {
              $centerSphere: [userCoordinates, distanceMeters / 6378137],
            },
          };
        }
      }
    }

    if (discover) {
      if (discover === "all") query.owner = { $exists: true };
      else if (discover === "me") query.owner = userId;
      else if (discover === "others") query.owner = { $nin: [userId] };
    }

    let clubs = [];
    let totalCount = 0;

    if (sort === "nearest") {
      // Use aggregation for nearest
      const currentUser = await User.findById(userId).select("geoLocation");
      const userCoordinates = currentUser?.geoLocation?.coordinates;

      if (!userCoordinates) {
        return res.status(400).json({ message: "User coordinates not found" });
      }

      clubs = await Club.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: userCoordinates },
            distanceField: "distance",
            spherical: true,
            key: "geoLocation",
          },
        },
        {
          $match: {
            ...query,
            name: { $regex: search, $options: "i" },
            location: { $regex: location, $options: "i" },
          },
        },
        {
          $lookup: {
            from: "clubreviews",
            localField: "_id",
            foreignField: "clubId",
            as: "reviews",
          },
        },
        {
          $addFields: {
            rating: {
              $round: [
                {
                  $cond: [
                    { $gt: [{ $size: "$reviews" }, 0] },
                    { $avg: "$reviews.rating" },
                    0,
                  ],
                },
                1,
              ],
            },
          },
        },
        { $skip: skip },
        { $limit: parseInt(limit) },
        { $project: { reviews: 0 } },
      ]);

      totalCount = await Club.countDocuments({
        location: { $regex: location, $options: "i" },
        name: { $regex: search, $options: "i" },
        ...query,
      });
    } else if (sort === "most_popular") {
      // Most popular = clubs with the most upcoming events + meets
      const now = new Date();
      const pipeline = [
        {
          $match: {
            ...query,
            name: { $regex: search, $options: "i" },
            location: { $regex: location, $options: "i" },
          },
        },
        {
          $lookup: {
            from: "events",
            let: { clubId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$club", "$$clubId"] },
                      { $gte: ["$date", now] },
                    ],
                  },
                },
              },
            ],
            as: "upcomingEvents",
          },
        },
        {
          $lookup: {
            from: "meets",
            let: { clubId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$club", "$$clubId"] },
                      { $gte: ["$date", now] },
                    ],
                  },
                },
              },
            ],
            as: "upcomingMeets",
          },
        },
        {
          $addFields: {
            upcomingEventsCount: {
              $size: { $ifNull: ["$upcomingEvents", []] },
            },
            upcomingMeetsCount: { $size: { $ifNull: ["$upcomingMeets", []] } },
            reviewCount: { $size: { $ifNull: ["$reviews", []] } },
          },
        },
        {
          $addFields: {
            totalUpcoming: {
              $add: ["$upcomingEventsCount", "$upcomingMeetsCount"],
            },
            averageRating: {
              $cond: {
                if: { $gt: [{ $size: "$reviews" }, 0] },
                then: { $avg: "$reviews.rating" },
                else: 0,
              },
            },
            rating: {
              $round: [
                {
                  $cond: [
                    { $gt: [{ $size: "$reviews" }, 0] },
                    { $avg: "$reviews.rating" },
                    0,
                  ],
                },
                1,
              ],
            },
          },
        },
        { $sort: { totalUpcoming: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            upcomingEvents: 0,
            upcomingMeets: 0,
            reviews: 0,
            averageRating: 0,
          },
        },
      ];

      clubs = await Club.aggregate(pipeline);

      // For total count, use the same match conditions without sorting/limits
      totalCount = await Club.countDocuments({
        ...query,
        name: { $regex: search, $options: "i" },
        location: { $regex: location, $options: "i" },
      });
    } else if (sort === "top_rated") {
      // Use aggregation to calculate average ratings and sort by rating
      const pipeline = [
        {
          $lookup: {
            from: "clubreviews",
            localField: "_id",
            foreignField: "clubId",
            as: "reviews",
          },
        },
        {
          $addFields: {
            averageRating: {
              $cond: {
                if: { $gt: [{ $size: "$reviews" }, 0] },
                then: { $avg: "$reviews.rating" },
                else: 0,
              },
            },
            reviewCount: { $size: "$reviews" },
            rating: {
              $round: [
                {
                  $cond: [
                    { $gt: [{ $size: "$reviews" }, 0] },
                    { $avg: "$reviews.rating" },
                    0,
                  ],
                },
                1,
              ],
            },
          },
        },
        {
          $match: {
            ...query,
            name: { $regex: search, $options: "i" },
            location: { $regex: location, $options: "i" },
          },
        },
        {
          $sort: { averageRating: -1, reviewCount: -1 }, // Sort by rating desc, then by review count desc
        },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            reviews: 0,
            averageRating: 0,
          },
        },
      ];

      clubs = await Club.aggregate(pipeline);

      // Get total count for pagination
      const countPipeline = [
        {
          $lookup: {
            from: "clubreviews",
            localField: "_id",
            foreignField: "clubId",
            as: "reviews",
          },
        },
        {
          $match: {
            ...query,
            name: { $regex: search, $options: "i" },
            location: { $regex: location, $options: "i" },
          },
        },
        { $count: "total" },
      ];

      const countResult = await Club.aggregate(countPipeline);
      totalCount = countResult.length > 0 ? countResult[0].total : 0;
    } else {
      // Normal find for other sorts
      const mongoQuery = {
        location: { $regex: location, $options: "i" },
        region: { $regex: regionSearch, $options: "i" },
        name: { $regex: search, $options: "i" },
        ...query,
      };

      if (sort === "recently_active") {
        mongoQuery.createdAt = {
          $gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
        };
      }

      totalCount = await Club.countDocuments(mongoQuery);
      clubs = await Club.find(mongoQuery)
        .skip(skip)
        .limit(limit)
        .populate({
          path: "events",
          populate: {
            path: "participants",
            populate: { path: "userId", select: "name email profilePicture" },
          },
        })
        .populate({ path: "meets" });

      // Attach averaged rating (one decimal) for these clubs
      const clubIds = clubs.map((c) => c._id);
      if (clubIds.length > 0) {
        const ratingAgg = await ClubReview.aggregate([
          { $match: { clubId: { $in: clubIds } } },
          { $group: { _id: "$clubId", avg: { $avg: "$rating" } } },
        ]);
        const idToRating = new Map(
          ratingAgg.map((r) => [String(r._id), Math.round(r.avg * 10) / 10])
        );
        clubs = clubs.map((c) => {
          const obj = c.toObject ? c.toObject() : c;
          obj.rating = idToRating.get(String(c._id)) || 0;
          return obj;
        });
      }
    }

    res.status(200).json({
      clubs,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get clubs", error: error.message });
  }
};

const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      region,
      description,
      url,
      location,
      clubEmail,
      phone,
      people,
      image,
    } = req.body;
    const owner = req.user.userId;

    let imageUrl = null;
    const imageFile = req.file;
    if (typeof image === "string") {
      imageUrl = image;
    } else if (imageFile) {
      const fileName = `clubs/${uuidv4()}-${imageFile.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: imageFile.buffer,
        ContentType: imageFile.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location;
    }

    let geoLocation = null;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          location
        )}&format=json&addressdetails=1&limit=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        // Extract coordinates for geospatial queries
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);

        if (!isNaN(lat) && !isNaN(lon)) {
          geoLocation = {
            type: "Point",
            coordinates: [lon, lat], // [longitude, latitude]
          };
          console.log("Coordinates extracted for update:", {
            lat,
            lon,
            geoLocation,
          });
        }
      }
    } catch (geoErr) {
      console.error("Geocoding error:", geoErr.message);
    }

    const club = await Club.findByIdAndUpdate(
      id,
      {
        name,
        region,
        description,
        url,
        location,
        geoLocation,
        clubEmail,
        phone,
        people,
        owner,
        image: imageUrl,
      },
      { new: true }
    );
    res.status(200).json({ message: "Club updated successfully", club: club });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update club", error: error.message });
  }
};

const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    if (!id) {
      return res
        .status(400)
        .json({ message: "Club ID is required", success: false });
    }
    const club = await Club.findById(id).populate("owner");
    if (!club) {
      return res
        .status(404)
        .json({ message: "Club not found", success: false });
    }
    if (club.owner.id !== userId || club.owner._id.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to delete this club",
        success: false,
      });
    }

    const events = await Event.find({ club: id });
    if (events.length > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete club with events", success: false });
    }
    const meets = await Meet.find({ club: id });
    if (meets.length > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete club with meets", success: false });
    }

    if (club.image) {
      const imageUrl = club.image;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: imageUrl,
      };
      await s3.deleteObject(params).promise();
    }
    await Club.findByIdAndDelete(id);
    await ClubReview.deleteMany({ clubId: id });
    
    res.status(200).json({
      message: "Club deleted successfully",
      club: club,
      success: true,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete club", error: error.message });
  }
};

const getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    const club = await Club.findById(id)
      .populate({
        path: "events",
        populate: {
          path: "participants",
          populate: {
            path: "userId",
            select: "username profileImage",
          },
        },
      })
      .populate({
        path: "meets",
        populate: {
          path: "participants",
          populate: {
            path: "userId",
            select: "username profileImage",
          },
        },
        populate: {
          path: "userId",
          select: "username profileImage",
        },
      });

    const reviews = await ClubReview.find({ clubId: id });
    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (acc, review) => acc + review.rating,
        0
      );
      averageRating = Math.round((totalRating / reviews.length) * 10) / 10; // one decimal place
    }
    club.rating = averageRating;

    res.status(200).json({ club });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to get club by id", error: error.message });
  }
};

module.exports = {
  createClub,
  getClubs,
  updateClub,
  deleteClub,
  getClubById,
};
