const ProfileHotlist = require("../models/hotlist/ProfileHotlistSchema");
const MeetHotlist = require("../models/hotlist/MeetHotlistSchema");
const EventHotlist = require("../models/hotlist/EventHotlistSchema");
const Friend = require("../models/FriendRequestSchema");

// Profile Hotlist
const getProfileHotlist = async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, search = "" } = req.query;
  try {
    // Build the query
    let query = { userId };

    // If search is provided, we need to populate first to search in user data
    if (search.trim()) {
      const profileHotlist = await ProfileHotlist.find(query)
        .populate(
          "profileId",
          "username profileImage about lookingFor firstName lastName age dateOfBirth"
        )
        .lean();

      // Filter by search term in populated user data
      const filteredHotlist = profileHotlist.filter((item) => {
        const profile = item.profileId;
        if (!profile) return false;

        const searchLower = search.toLowerCase();
        return (
          profile.username?.toLowerCase().includes(searchLower) ||
          profile.firstName?.toLowerCase().includes(searchLower) ||
          profile.lastName?.toLowerCase().includes(searchLower)
        );
      });

      // Add isFriend check for each profile
      const profilesWithFriendStatus = await Promise.all(
        filteredHotlist.map(async (item) => {
          const profile = item.profileId;
          if (!profile) return item;

          // Check if they are friends
          const friendship = await Friend.findOne({
            $or: [
              { sender: userId, receiver: profile._id },
              { sender: profile._id, receiver: userId },
            ],
            status: { $in: ["accepted", "pending"] },
          });

          return {
            ...item,
            profileId: {
              ...profile,
              friendStatus: friendship ? friendship.status : null,
            },
          };
        })
      );

      const total = profilesWithFriendStatus.length;
      const paginatedProfileHotlist = profilesWithFriendStatus.slice(
        (page - 1) * limit,
        page * limit
      );

      return res.json({
        profileHotlist: paginatedProfileHotlist,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } else {
      // No search - use MongoDB pagination
      const total = await ProfileHotlist.countDocuments(query);

      const profileHotlist = await ProfileHotlist.find(query)
        .populate(
          "profileId",
          "username profileImage about lookingFor firstName lastName age dateOfBirth"
        )
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      // Add isFriend check for each profile
      const profilesWithFriendStatus = await Promise.all(
        profileHotlist.map(async (item) => {
          const profile = item.profileId;
          if (!profile) return item;

          // Check if they are friends
          const friendship = await Friend.findOne({
            $or: [
              { sender: userId, receiver: profile._id },
              { sender: profile._id, receiver: userId },
            ],
            status: { $in: ["accepted", "pending"] },
          });

          // Convert profile to plain object if it's a Mongoose document
          const profileObj = profile.toObject ? profile.toObject() : profile;

          // Convert the entire item to a plain object to avoid Mongoose internals
          const itemObj = item.toObject ? item.toObject() : item;

          return {
            ...itemObj,
            profileId: {
              ...profileObj,
              friendStatus: friendship ? friendship : null,
            },
          };
        })
      );

      res.json({
        profileHotlist: profilesWithFriendStatus,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: profilesWithFriendStatus.length === parseInt(limit),
      });
    }
  } catch (error) {
    console.error("Error in getProfileHotlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const isProfileInHotlist = async (req, res) => {
  const { profileId } = req.body;
  const userId = req.user.userId;
  const hotlist = await ProfileHotlist.findOne({ profileId, userId });
  res.json({ isInHotlist: !!hotlist });
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

// Event Hotlist
const getEventHotlist = async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, search = "" } = req.query;
  try {
    if (search.trim()) {
      // For search, get all events first, then filter and paginate
      const eventHotlist = await EventHotlist.find({ userId })
        .populate("eventId")
        .sort({ createdAt: -1 });

      // Flatten so we return event objects directly
      const events = eventHotlist
        .filter((h) => !!h.eventId)
        .map((h) => {
          const ev = h.eventId.toObject();
          ev.isHotlisted = true;
          ev.hotlistedAt = h.createdAt;
          return ev;
        });

      // Filter by search term
      const filteredEvents = events.filter((e) => {
        return e.title.toLowerCase().includes(search.toLowerCase());
      });

      const total = filteredEvents.length;
      const paginatedEvents = filteredEvents.slice(
        (page - 1) * limit,
        page * limit
      );

      return res.json({
        eventHotlist: paginatedEvents,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: paginatedEvents.length === parseInt(limit),
      });
    } else {
      // No search - use MongoDB pagination
      const total = await EventHotlist.countDocuments({ userId });

      const eventHotlist = await EventHotlist.find({ userId })
        .populate("eventId")
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      // Flatten so we return event objects directly
      const events = eventHotlist
        .filter((h) => !!h.eventId)
        .map((h) => {
          const ev = h.eventId.toObject();
          ev.isHotlisted = true;
          ev.hotlistedAt = h.createdAt;
          return ev;
        });

      res.json({
        eventHotlist: events,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: events.length === parseInt(limit),
      });
    }
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

// Meet Hotlist
const getMeetHotlist = async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, search = "" } = req.query;
  try {
    if (search.trim()) {
      // For search, get all meets first, then filter and paginate
      const meetHotlist = await MeetHotlist.find({ userId })
        .populate("meetId")
        .populate("userId", "username profileImage")
        .sort({ createdAt: -1 });

      const meets = meetHotlist
        .filter((h) => !!h.meetId)
        .map((h) => {
          const meet = h.meetId.toObject();
          meet.isHotlisted = true;
          meet.hotlistedAt = h.createdAt;
          meet.userId = h.userId;
          return meet;
        });

      // Filter by search term
      const filteredMeetHotlist = meets.filter((h) => {
        return h.title.toLowerCase().includes(search.toLowerCase());
      });

      const total = filteredMeetHotlist.length;
      const paginatedMeetHotlist = filteredMeetHotlist.slice(
        (page - 1) * limit,
        page * limit
      );

      return res.json({
        meetHotlist: paginatedMeetHotlist,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: paginatedMeetHotlist.length === parseInt(limit),
      });
    } else {
      // No search - use MongoDB pagination
      const total = await MeetHotlist.countDocuments({ userId });

      const meetHotlist = await MeetHotlist.find({ userId })
        .populate("meetId")
        .populate("userId", "username profileImage")
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const meets = meetHotlist
        .filter((h) => !!h.meetId)
        .map((h) => {
          const meet = h.meetId.toObject();
          meet.isHotlisted = true;
          meet.hotlistedAt = h.createdAt;
          meet.userId = h.userId;
          return meet;
        });

      res.json({
        meetHotlist: meets,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: meets.length === parseInt(limit),
      });
    }
  } catch (error) {
    console.error("Error in getMeetHotlist:", error);
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

module.exports = {
  getProfileHotlist,
  isProfileInHotlist,
  addProfileToHotlist,
  deleteProfileFromHotlist,
  getEventHotlist,
  addEventToHotlist,
  deleteEventFromHotlist,
  addMeetToHotlist,
  deleteMeetFromHotlist,
  getMeetHotlist,
};
