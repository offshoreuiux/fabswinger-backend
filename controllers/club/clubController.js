const Club = require("../../models/club/clubSchema");
const s3 = require("../../utils/s3");
const { v4: uuidv4 } = require("uuid");
const Event = require("../../models/event/EventSchema");
const Meet = require("../../models/meet/MeetSchema");

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
    imageUrl = uploadResult.Location;

    const club = new Club({
      name,
      region,
      description,
      url,
      location,
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
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const totalCount = await Club.countDocuments();
    const clubs = await Club.find({
      name: { $regex: search, $options: "i" },
    })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "events",
        populate: {
          path: "participants",
          populate: {
            path: "userId",
            select: "name email profilePicture",
          },
        },
      })
      .populate({
        path: "meets",
      });
    res.status(200).json({
      clubs,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
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
    const club = await Club.findByIdAndUpdate(
      id,
      {
        name,
        region,
        description,
        url,
        location,
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
      return res
        .status(403)
        .json({
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
