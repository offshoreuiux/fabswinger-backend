const Channel = require("../../models/forum/ChannelSchema");
const Member = require("../../models/forum/MemberSchema");
const { v4: uuidv4 } = require("uuid");
const s3 = require("../../utils/s3");

const createChannel = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required",
      });
    }

    const { userId } = req.user;

    const channel = await Channel.create({
      name,
      description,
      createdBy: userId,
    });
    await Member.create({
      userId,
      channelId: channel._id,
      role: "admin",
    });

    return res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getChannels = async (req, res) => {
  try {
    const { userId } = req.user;
    const channels = await Channel.find();
    const member = await Member.find({
      userId,
    });
    const channelsWithMember = channels.map((channel) => {
      return {
        ...channel.toObject(),
        isMember: member.some(
          (m) => m.channelId.toString() === channel._id.toString()
        ),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Channels fetched successfully",
      channels: channelsWithMember,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getChannelById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Channel ID is required",
      });
    }

    const channel = await Channel.findById(id)
      .populate("createdBy", "name profileImage")
      .populate("posts")
      .populate({
        path: "members",
        populate: {
          path: "userId",
          select: "username profileImage",
        },
      });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    const isMember = await Member.findOne({
      userId: req.user.userId,
      channelId: id,
    });
    const isAdmin = await Member.findOne({
      userId: req.user.userId,
      channelId: id,
      role: "admin",
    });

    const channelObj = channel.toObject();
    channelObj.isMember = !!isMember;
    channelObj.isAdmin = !!isAdmin;

    return res.status(200).json({
      success: true,
      message: "Channel fetched successfully",
      channel: channelObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const imageFile = req.files?.image?.[0];
    const bgFile = req.files?.backgroundImage?.[0];

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Channel ID is required" });
    }

    const updateData = {};

    if (imageFile) {
      const fileName = `channels/images/${uuidv4()}-${imageFile.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: imageFile.buffer,
        ContentType: imageFile.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      updateData.image = uploadResult.Location;
    }
    if (bgFile) {
      const fileName = `channels/backgroundImages/${uuidv4()}-${
        bgFile.originalname
      }`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: bgFile.buffer,
        ContentType: bgFile.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      updateData.backgroundImage = uploadResult.Location;
    }
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const channel = await Channel.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("createdBy", "name profileImage")
      .populate({
        path: "members",
        populate: {
          path: "userId",
          select: "username profileImage",
        },
      });

    const channelObj = channel.toObject();
    channelObj.isMember = true;
    channelObj.isAdmin = true;

    if (!channel) {
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Channel updated successfully",
      channel: channelObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createChannel,
  getChannels,
  getChannelById,
  updateChannel,
};
