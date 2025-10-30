const Meet = require("../../models/meet/MeetSchema");
const MeetHotlist = require("../../models/hotlist/MeetHotlistSchema");
const MeetParticipant = require("../../models/meet/MeetParticipantSchema");
const SubscriptionSchema = require("../../models/payment/SubscriptionSchema");
// const Club = require("../models/ClubSchema");
const { v4: uuidv4 } = require("uuid");
const { s3 } = require("../../utils/s3");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

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

    //Check user subscription status
    const subscription = await SubscriptionSchema.findOne({ userId });
    console.log("subscription?.status:", subscription?.status);

    //Fetch all meets by this user
    const userMeets = await Meet.find({ userId });
    const now = new Date();

    // Filter active (upcoming) meets
     const activeMeets = userMeets.filter((meet) => {
      const meetDateTime = new Date(meet.date);
      if (meet.time) {
        const [hours, minutes] = meet.time.split(":").map(Number);
        meetDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      }
      return meetDateTime >= now; // still upcoming
    });

    const activeCount = activeMeets.length;

    //Apply meet creation limits
    if (!subscription || subscription.status !== "active") {
      // Non-subscribed user → only 1 active meet
      if (activeCount >= 1) {
        return res.status(403).json({
          success: false,
          message:
            "You can create only one meet at a time. Wait until your current meet date has passed.",
        });
      }
    } else if (subscription.status === "active" && activeCount >= 10) {
      // Subscribed user → up to 10 active meets
      return res.status(403).json({
        success: false,
        message:
          "You have reached your limit of 10 active meets. You can create new ones once existing meets are completed.",
      });
    }

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
    let state = null;
    let country = null;
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          location
        )}&format=json&addressdetails=1&limit=1`
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
        state = geocodeData[0].address.state.toLowerCase();
        country = geocodeData[0].address.country.toLowerCase();
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
      state,
      country,
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

    console.log("newMeet", {
      userId,
      title,
      description,
      date,
      time,
      location,
      state,
      country,
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
      role: "organizer",
    });
    const meet = await Meet.findById(newMeet._id).populate(
      "userId",
      "username profileImage"
    );

    res.status(201).json({ message: "Meet created successfully", meet });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get events with flexible filtering - only shows meets where user is a participant
const getMeets = async (req, res) => {
  try {
    const { type = "all", limit = 10, page = 1, filters = {} } = req.query;
    const userId = req.user.userId; // Get current user ID
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const { show, when, meetType, countryRegion, createdBy } =
      JSON.parse(filters);

    // First, get all meet IDs where the user is a participant
    const userParticipations = await MeetParticipant.find({ userId }).sort({
      createdAt: -1,
    });
    const userMeetIds = userParticipations.map(
      (participation) => participation.meetId
    );

    // If user has no participations, return empty result
    if (userMeetIds.length === 0 && type !== "all") {
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
    let selectedPeople = [];

    if (createdBy === "me") {
      query.userId = userId;
    } else if (createdBy === "others") {
      query.userId = { $nin: userId };
    }

    if (show?.women) {
      selectedPeople.push("Woman");
    }
    if (show?.men) {
      selectedPeople.push("Man");
    }
    if (show?.mf) {
      selectedPeople.push("Couple(M/F)");
    }
    if (show?.mm) {
      selectedPeople.push("Couple(M/M)");
    }
    if (show?.ff) {
      selectedPeople.push("Couple(F/F)");
    }
    if (show?.tv) {
      selectedPeople.push("TV/TS/CD");
    }

    if (selectedPeople.length > 0) {
      query.people = { $in: selectedPeople };
    }

    if (when === "today") {
      query.date = {
        $gte: new Date(),
        $lt: new Date(new Date().setDate(new Date().getDate() + 1)),
      };
    } else if (when === "this_week") {
      query.date = {
        $gte: new Date(),
        $lt: new Date(new Date().setDate(new Date().getDate() + 7)),
      };
    } else if (when === "this_month") {
      query.date = {
        $gte: new Date(),
        $lt: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      };
    } else if (when === "upcoming") {
      query.date = { $gte: new Date() };
    } else {
      query.date = { $gte: new Date() };
    }

    if (meetType && meetType !== "all") {
      query.meetType = meetType;
    }

    if (countryRegion && countryRegion !== "all") {
      query.country = countryRegion.toLowerCase();
    }

    console.log("query", query);

    switch (type) {
      case "scheduled":
        query.date = { $gte: new Date() };
        query._id = { $in: userMeetIds };
        totalCount = await Meet.countDocuments(query);
        meets = await Meet.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage")
          .sort({ createdAt: -1 });
        break;
      case "history":
        query.date = { $lt: new Date() };
        query._id = { $in: userMeetIds };
        totalCount = await Meet.countDocuments(query);
        meets = await Meet.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage")
          .sort({ createdAt: -1 });
        break;
      default: // 'all'
        // Get all events
        totalCount = await Meet.countDocuments(query);
        meets = await Meet.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("userId", "username profileImage")
          .sort({ createdAt: -1 });
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
      state,
      country,
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

    let newCoordinates = coordinates;
    let newState = state;
    let newCountry = country;
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          location
        )}&limit=1`
      );
      const geocodeData = await geocodeResponse.json();
      console.log("geocodeData", geocodeData);

      if (geocodeData && geocodeData.length > 0) {
        newCoordinates = {
          type: "Point",
          coordinates: [
            parseFloat(geocodeData[0].lon),
            parseFloat(geocodeData[0].lat),
          ],
        };
        newState = geocodeData[0].state.toLowerCase();
        newCountry = geocodeData[0].country.toLowerCase();
      }
    } catch (geocodeError) {
      console.log("Geocoding failed:", geocodeError.message);
    }

    const meet = await Meet.findByIdAndUpdate(
      id,
      {
        title,
        description,
        date,
        time,
        location,
        coordinates: newCoordinates,
        state: newState,
        country: newCountry,
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
  console.log("getMeetById called with id:", req.params.id);
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate ObjectId
    if (!require("mongoose").Types.ObjectId.isValid(id)) {
      console.error("Invalid meet ID in getMeetById:", id);
      return res.status(400).json({ message: "Invalid meet ID" });
    }

    const meet = await Meet.findById(id).populate(
      "userId",
      "username profileImage"
    );

    if (!meet) {
      return res.status(404).json({ message: "Meet not found" });
    }

    const participants = await MeetParticipant.find({ meetId: id });
    meet.participants = participants;
    const meetWithHotlistInfo = await addHotlistInfoToMeet(meet, userId);
    const meetWithParticipantDetails = await addParticipantDetailsToMeet(
      meetWithHotlistInfo,
      userId
    );
    res.status(200).json({ meet: meetWithParticipantDetails });
  } catch (error) {
    console.error("Error in getMeetById:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getUserMeets = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, sortBy = "all", date } = req.query;

    if (sortBy === "createdByMe") {
      // Build query with date filter if provided
      const createdQuery = { userId: userId };

      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          createdQuery.date = filterDate;
        }
      }

      const createdMeets = await Meet.find(createdQuery)
        .populate("userId", "username profileImage")
        .sort({ createdAt: -1 });
      const meetsWithHotlistInfo = await addHotlistInfoToMeets(
        createdMeets,
        userId
      );
      const meetsWithParticipantDetails = await addParticipantDetailsToMeets(
        meetsWithHotlistInfo,
        userId
      );
      res.status(200).json({
        meets: meetsWithParticipantDetails,
        success: true,
        hasMore: meetsWithParticipantDetails.length === parseInt(limit),
      });
    } else if (sortBy === "scheduled") {
      const scheduledMeetsParticipants = await MeetParticipant.find({
        userId: userId,
        status: "approved",
      }).sort({ createdAt: -1 });
      const scheduledMeetIds = scheduledMeetsParticipants.map(
        (scheduledMeet) => scheduledMeet.meetId
      );

      // Build query with date filter if provided
      const scheduledQuery = {
        _id: { $in: scheduledMeetIds },
        date: { $gte: new Date() },
      };

      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          scheduledQuery.date = filterDate;
        }
      }

      const scheduledMeets = await Meet.find(scheduledQuery)
        .populate("userId", "username profileImage")
        .sort({ createdAt: -1 });
      const meetsWithHotlistInfo = await addHotlistInfoToMeets(
        scheduledMeets,
        userId
      );
      const meetsWithParticipantDetails = await addParticipantDetailsToMeets(
        meetsWithHotlistInfo,
        userId
      );
      res.status(200).json({
        meets: meetsWithParticipantDetails,
        success: true,
        hasMore: meetsWithParticipantDetails.length === parseInt(limit),
      });
    } else if (sortBy === "requested") {
      const requestedMeets = await MeetParticipant.find({
        userId,
        status: "applied",
      }).sort({ createdAt: -1 });
      const requestedMeetIds = requestedMeets.map(
        (requestedMeet) => requestedMeet.meetId
      );

      // Build query with date filter if provided
      const requestedQuery = {
        _id: { $in: requestedMeetIds },
      };

      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          requestedQuery.date = filterDate;
        }
      }

      const meets = await Meet.find(requestedQuery)
        .populate("userId", "username profileImage")
        .sort({ createdAt: -1 });
      const meetsWithHotlistInfo = await addHotlistInfoToMeets(meets, userId);
      const meetsWithParticipantDetails = await addParticipantDetailsToMeets(
        meetsWithHotlistInfo,
        userId
      );
      res.status(200).json({
        meets: meetsWithParticipantDetails,
        success: true,
        hasMore: meetsWithParticipantDetails.length === parseInt(limit),
      });
    } else {
      // Get meets created by the user
      // const createdMeets = await Meet.find({ userId: userId }).populate(
      //   "userId",
      //   "username profileImage"
      // );

      // Get meets where the user is a participant (but not the creator)
      const userParticipations = await MeetParticipant.find({
        userId,
        status: { $in: ["approved", "applied"] }, // Include both approved and pending participations
      });

      const participatedMeetIds = userParticipations.map(
        (participation) => participation.meetId
      );

      // Get meets where user is a participant but not the creator
      let participatedMeets = [];
      if (participatedMeetIds.length > 0) {
        // Build query with date filter if provided
        const participatedQuery = {
          _id: { $in: participatedMeetIds },
        };

        if (date && date !== "undefined" && date !== "null") {
          const filterDate = new Date(date);
          if (!isNaN(filterDate.getTime())) {
            participatedQuery.date = filterDate;
          }
        }

        participatedMeets = await Meet.find(participatedQuery)
          .populate("userId", "username profileImage")
          .sort({ createdAt: -1 });
      }

      // Combine both arrays
      // const allMeets = [...createdMeets, ...participatedMeets];

      // Sort by creation date (newest first)
      participatedMeets.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      const meetsWithHotlistInfo = await addHotlistInfoToMeets(
        participatedMeets,
        userId
      );
      const meetsWithParticipantDetails = await addParticipantDetailsToMeets(
        meetsWithHotlistInfo,
        userId
      );

      res.status(200).json({
        meets: meetsWithParticipantDetails,
        success: true,
        hasMore: meetsWithParticipantDetails.length === parseInt(limit),
      });
    }
  } catch (error) {
    console.error("Error in getUserMeets:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      success: false,
    });
  }
};

module.exports = {
  createMeet,
  getMeets,
  updateMeet,
  getMeetById,
  getUserMeets,
};

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
