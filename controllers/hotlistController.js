const ProfileHotlist = require("../models/hotlist/ProfileHotlistModel");
const MeetingHotlist = require("../models/hotlist/MeetingHotlistModel");
const EventHotlist = require("../models/hotlist/EventHotlistModel");

const getProfileHotlist = async (req, res) => {
  const userId = req.user.userId;
  try {
    const profileHotlist = await ProfileHotlist.find({ userId });
    res.json(profileHotlist);
  } catch (error) {
    console.error("Error in getProfileHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const addProfileToHotlist = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "Profile ID is required" });
  }
  const { profileId } = req.body;
  const userId = req.user.userId;

  if (!profileId) {
    return res.status(400).json({ error: "Profile ID is required" });
  }

  try {
    const existingHotlist = await ProfileHotlist.findOne({
      profileId,
      userId,
    });

    if (existingHotlist) {
      return res.status(400).json({ error: "Profile already in hotlist" });
    }

    const newHotlist = new ProfileHotlist({ profileId, userId });
    await newHotlist.save();

    res.json({
      message: "Profile added to hotlist",
      profileId: newHotlist.profileId,
    });
  } catch (error) {
    console.error("Error in addProfileToHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteProfileFromHotlist = async (req, res) => {
  const { profileId } = req.body;
  const userId = req.user.userId;

  if (!profileId) {
    return res.status(400).json({ error: "Profile ID is required" });
  }

  try {
    const existingHotlist = await ProfileHotlist.findOneAndDelete({
      profileId,
      userId,
    });

    if (!existingHotlist) {
      return res.status(400).json({ error: "Profile not in hotlist" });
    }

    res.json({
      message: "Profile removed from hotlist",
      profileId: existingHotlist.profileId,
    });
  } catch (error) {
    console.error("Error in deleteProfileFromHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getProfileHotlist,
  addProfileToHotlist,
  deleteProfileFromHotlist,
};
