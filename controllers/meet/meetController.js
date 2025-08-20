const Meet = require("../../models/meet/MeetSchema");
const MeetHotlist = require("../../models/hotlist/MeetHotlistModel");
const MeetParticipant = require("../../models/meet/MeetParticipantSchema");
// const Club = require("../models/ClubSchema");
const { v4: uuidv4 } = require("uuid");
const s3 = require("../../utils/s3");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Helper function to add hotlist information to events
const addHotlistInfoToMeets = async (meets, userId) => {
  try {
    // Get user's hotlisted events

    const userHotlistedMeets = await MeetHotlist.find({ userId });
    const hotlistedMeetIds = userHotlistedMeets.map((hotlist) =>
      hotlist.meetId.toString()
    );

    // Add hotlist information to each event
    return meets.map((meet) => {
      const meetObj = meet.toObject();
      meetObj.isHotlisted = hotlistedMeetIds.includes(meet._id.toString());
      return meetObj;
    });
  } catch (error) {
    console.error("Error adding hotlist info:", error);
    // Return events without hotlist info if there's an error
    return meets.map((meet) => {
      const meetObj = meet.toObject();
      meetObj.isHotlisted = false;
      return meetObj;
    });
  }
};

// Helper function to add hotlist information to a single event
const addHotlistInfoToMeet = async (meet, userId) => {
  try {
    // Get user's hotlisted events
    const userHotlistedMeets = await MeetHotlist.find({ userId });
    const hotlistedMeetIds = userHotlistedMeets.map((hotlist) =>
      hotlist.meetId.toString()
    );

    // Add hotlist information to the event
    const meetObj = meet.toObject();
    meetObj.isHotlisted = hotlistedMeetIds.includes(meet._id.toString());
    return meetObj;
  } catch (error) {
    console.error("Error adding hotlist info:", error);
    // Return event without hotlist info if there's an error
    const meetObj = meet.toObject();
    meetObj.isHotlisted = false;
    return meetObj;
  }
};

const addParticipantDetailsToMeets = async (meets, userId) => {
  try {
    const meetsWithParticipantDetails = await Promise.all(
      meets.map(async (meet) => {
        const participants = await MeetParticipant.find({
          meetId: meet._id,
          // status: "approved",
        }).populate("userId", "username profileImage");
        meet.participants = participants;
        return meet;
      })
    );
    return meetsWithParticipantDetails;
  } catch (error) {
    console.error("Error adding participant details:", error);
    return meets;
  }
};

// Helper function to add participant details to a single event
const addParticipantDetailsToMeet = async (meet, userId) => {
  try {
    const participants = await MeetParticipant.find({
      meetId: meet._id,
      // status: "approved",
    }).populate("userId", "username profileImage");
    meet.participants = participants;
    return meet;
  } catch (error) {
    console.error("Error adding participant details:", error);
    return meet;
  }
};

const createMeet = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      title,
      description,
      date,
      time,
      location,
      meetType,
      capacity,
      club,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
    } = req.body;

    // Handle people array from FormData
    let people = req.body.people;
    if (typeof people === "string") {
      people = [people];
    } else if (Array.isArray(people)) {
      people = people;
    } else {
      people = [];
    }
    console.log("Request body:", req.body);
    console.log("People field:", people);

    if (
      !title ||
      !description ||
      !date ||
      !time ||
      !location ||
      !meetType ||
      !capacity ||
      !club ||
      !people ||
      rsvpFriends === undefined ||
      rsvpVerified === undefined ||
      rsvpEveryone === undefined ||
      joinRequest === undefined
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Geocode location to get coordinates
    let coordinates = null;
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          location
        )}&limit=1`
      );
      const geocodeData = await geocodeResponse.json();
      console.log("geocodeData", geocodeData);

      if (geocodeData && geocodeData.length > 0) {
        coordinates = {
          type: "Point",
          coordinates: [
            parseFloat(geocodeData[0].lon),
            parseFloat(geocodeData[0].lat),
          ],
        };
      }
    } catch (geocodeError) {
      console.log("Geocoding failed:", geocodeError.message);
    }

    const newMeet = new Meet({
      userId,
      title,
      description,
      date,
      time,
      location,
      coordinates,
      meetType,
      capacity,
      club,
      people,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
    });
    await newMeet.save();
    await MeetParticipant.create({
      meetId: newMeet._id,
      userId,
      status: "approved",
    });

    res
      .status(201)
      .json({ message: "Meet created successfully", meet: newMeet });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get events with flexible filtering - only shows meets where user is a participant
const getMeets = async (req, res) => {
  try {
    const { type = "all", limit = 10, page = 1 } = req.query;

    const userId = req.user.userId; // Get current user ID
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // First, get all meet IDs where the user is a participant
    const userParticipations = await MeetParticipant.find({ userId });
    const userMeetIds = userParticipations.map(
      (participation) => participation.meetId
    );

    // If user has no participations, return empty result
    if (userMeetIds.length === 0) {
      return res.status(200).json({
        meets: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      });
    }

    let meets;
    let totalCount;
    let query = {};

    switch (type) {
      case "scheduled":
        query.date = { $gte: new Date() };
        query._id = { $in: userMeetIds };
        totalCount = await Meet.countDocuments(query);
        meets = await Meet.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage");
        break;
      case "history":
        query.date = { $lt: new Date() };
        query._id = { $in: userMeetIds };
        totalCount = await Meet.countDocuments(query);
        meets = await Meet.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage");
        break;
      default: // 'all'
        // Get all events
        totalCount = await Meet.countDocuments();
        meets = await Meet.find()
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage");
        break;
    }

    // Add hotlist information to events
    const meetsWithHotlistInfo = await addHotlistInfoToMeets(meets, userId);
    const meetsWithParticipantDetails = await addParticipantDetailsToMeets(
      meetsWithHotlistInfo,
      userId
    );

    res.status(200).json({
      meets: meetsWithParticipantDetails,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
    });
  } catch (error) {
    console.error("Error in getMeets:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const updateMeet = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      date,
      time,
      location,
      meetType,
      capacity,
      club,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
      coordinates,
    } = req.body;
    console.log("title", title);

    // Handle people array from FormData
    let people = req.body.people;
    if (typeof people === "string") {
      people = [people];
    } else if (Array.isArray(people)) {
      people = people;
    } else {
      people = [];
    }

    const meet = await Meet.findByIdAndUpdate(
      id,
      {
        title,
        description,
        date,
        time,
        location,
        coordinates,
        meetType,
        capacity,
        club,
        people,
        rsvpFriends,
        rsvpVerified,
        rsvpEveryone,
        joinRequest,
      },
      { new: true }
    );
    if (!meet) {
      return res.status(404).json({ message: "Meet not found" });
    }

    res.status(200).json({ message: "Meet updated successfully", meet });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getMeetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const meet = await Meet.findById(id).populate(
      "userId",
      "username profileImage"
    );
    const participants = await MeetParticipant.find({ meetId: id });
    meet.participants = participants;
    const meetWithHotlistInfo = await addHotlistInfoToMeet(meet, userId);
    const meetWithParticipantDetails = await addParticipantDetailsToMeet(
      meetWithHotlistInfo,
      userId
    );
    res.status(200).json({ meet: meetWithParticipantDetails });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  createMeet,
  getMeets,
  updateMeet,
  getMeetById,
};
