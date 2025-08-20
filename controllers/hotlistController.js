const ProfileHotlist = require("../models/hotlist/ProfileHotlistModel");
const MeetHotlist = require("../models/hotlist/MeetHotlistModel");
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

const getEventHotlist = async (req, res) => {
  const userId = req.user.userId;
  try {
    const eventHotlist = await EventHotlist.find({ userId }).populate(
      "eventId"
    );

    // Flatten so we return event objects directly
    const events = eventHotlist
      .filter((h) => !!h.eventId)
      .map((h) => {
        const ev = h.eventId.toObject();
        ev.isHotlisted = true;
        ev.hotlistedAt = h.createdAt;
        return ev;
      });

    res.json(events);
  } catch (error) {
    console.error("Error in getEventHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const addEventToHotlist = async (req, res) => {
  const userId = req.user.userId;
  const { eventId } = req.body;
  if (!eventId) {
    return res.status(400).json({ error: "Event ID is required" });
  }

  try {
    const existingHotlist = await EventHotlist.findOne({
      eventId,
      userId,
    });

    if (existingHotlist) {
      return res.status(400).json({ error: "Event already in hotlist" });
    }

    const newHotlist = new EventHotlist({ eventId, userId });
    await newHotlist.save();

    res.json({
      message: "Event added to hotlist",
      eventId: newHotlist.eventId,
    });
  } catch (error) {
    console.error("Error in addEventToHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteEventFromHotlist = async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.userId;

  if (!eventId) {
    return res.status(400).json({ error: "Event ID is required" });
  }

  try {
    const existingHotlist = await EventHotlist.findOneAndDelete({
      eventId,
      userId,
    });

    if (!existingHotlist) {
      return res.status(400).json({ error: "Event not in hotlist" });
    }

    res.json({
      message: "Event removed from hotlist",
      eventId: existingHotlist.eventId,
    });
  } catch (error) {
    console.error("Error in deleteEventFromHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const addMeetToHotlist = async (req, res) => {
  const { meetId } = req.body;
  const userId = req.user.userId;

  if (!meetId) {
    return res.status(400).json({ error: "Meet ID is required" });
  }
  try {
    const existingHotlist = await MeetHotlist.findOne({
      meetId,
      userId,
    });

    if (existingHotlist) {
      return res.status(400).json({ error: "Meet already in hotlist" });
    }

    const newHotlist = new MeetHotlist({ meetId, userId });
    await newHotlist.save();

    res.json({
      message: "Meet added to hotlist",
      meetId: newHotlist.meetId,
    });
  } catch (error) {
    console.error("Error in addMeetToHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteMeetFromHotlist = async (req, res) => {
  const { meetId } = req.body;
  const userId = req.user.userId;

  if (!meetId) {
    return res.status(400).json({ error: "Meet ID is required" });
  }

  try {
    const existingHotlist = await MeetHotlist.findOneAndDelete({
      meetId,
      userId,
    });

    if (!existingHotlist) {
      return res.status(400).json({ error: "Meet not in hotlist" });
    }

    res.json({
      message: "Meet removed from hotlist",
      meetId: existingHotlist.meetId,
    });
  } catch (error) {
    console.error("Error in deleteMeetFromHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getMeetHotlist = async (req, res) => {
  const userId = req.user.userId;
  try {
    const meetHotlist = await MeetHotlist.find({ userId }).populate("meetId");

    const meets = meetHotlist
      .filter((h) => !!h.meetId)
      .map((h) => {
        const meet = h.meetId.toObject();
        meet.isHotlisted = true;
        meet.hotlistedAt = h.createdAt;
        return meet;
      });

    res.json(meets);
  } catch (error) {
    console.error("Error in getMeetHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getProfileHotlist,
  addProfileToHotlist,
  deleteProfileFromHotlist,
  getEventHotlist,
  addEventToHotlist,
  deleteEventFromHotlist,
  addMeetToHotlist,
  deleteMeetFromHotlist,
  getMeetHotlist,
};
