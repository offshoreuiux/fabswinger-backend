const Event = require("../../models/event/EventSchema");
const EventHotlist = require("../../models/hotlist/EventHotlistSchema");
const EventParticipant = require("../../models/event/EventParticipantSchema");
// const Club = require("../models/ClubSchema");
const { v4: uuidv4 } = require("uuid");
const s3 = require("../../utils/s3");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Helper function to add hotlist information to events
const addHotlistInfoToEvents = async (events, userId) => {
  try {
    // Get user's hotlisted events

    const userHotlistedEvents = await EventHotlist.find({ userId });
    const hotlistedEventIds = userHotlistedEvents.map((hotlist) =>
      hotlist.eventId.toString()
    );

    // Add hotlist information to each event
    return events.map((event) => {
      const eventObj = event.toObject();
      eventObj.isHotlisted = hotlistedEventIds.includes(event._id.toString());
      return eventObj;
    });
  } catch (error) {
    console.error("Error adding hotlist info:", error);
    // Return events without hotlist info if there's an error
    return events.map((event) => {
      const eventObj = event.toObject();
      eventObj.isHotlisted = false;
      return eventObj;
    });
  }
};

// Helper function to add hotlist information to a single event
const addHotlistInfoToEvent = async (event, userId) => {
  try {
    // Get user's hotlisted events
    const userHotlistedEvents = await EventHotlist.find({ userId });
    const hotlistedEventIds = userHotlistedEvents.map((hotlist) =>
      hotlist.eventId.toString()
    );

    // Add hotlist information to the event
    const eventObj = event.toObject();
    eventObj.isHotlisted = hotlistedEventIds.includes(event._id.toString());
    return eventObj;
  } catch (error) {
    console.error("Error adding hotlist info:", error);
    // Return event without hotlist info if there's an error
    const eventObj = event.toObject();
    eventObj.isHotlisted = false;
    return eventObj;
  }
};

const addParticipantDetailsToEvents = async (events, userId) => {
  try {
    const eventsWithParticipantDetails = await Promise.all(
      events.map(async (event) => {
        const participants = await EventParticipant.find({
          eventId: event._id,
          // status: "approved",
        }).populate(
          "userId",
          "username profilePicture firstName lastName people"
        );
        event.participants = participants;
        return event;
      })
    );
    return eventsWithParticipantDetails;
  } catch (error) {
    console.error("Error adding participant details:", error);
    return events;
  }
};

// Helper function to add participant details to a single event
const addParticipantDetailsToEvent = async (event, userId) => {
  try {
    const participants = await EventParticipant.find({
      eventId: event._id,
      // status: "approved",
    }).populate("userId", "username profilePicture firstName lastName people");
    event.participants = participants;
    return event;
  } catch (error) {
    console.error("Error adding participant details:", error);
    return event;
  }
};

const createEvent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      title,
      description,
      date,
      time,
      location,
      eventType,
      capacity,
      club,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
      ageRange: ageRangeStr,
      eventRules,
    } = req.body;

    // Parse ageRange from JSON string to array
    let ageRange;
    try {
      ageRange = JSON.parse(ageRangeStr);
    } catch (error) {
      return res.status(400).json({ message: "Invalid age range format" });
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
    console.log("Request file:", req.file);
    const image = req.file;
    console.log("Image file:", image);

    if (
      !title ||
      !description ||
      !date ||
      !time ||
      !location ||
      !eventType ||
      !capacity ||
      !club ||
      !people ||
      rsvpFriends === undefined ||
      rsvpVerified === undefined ||
      rsvpEveryone === undefined ||
      joinRequest === undefined ||
      ageRange === undefined
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let imageUrl = null;
    if (image) {
      const fileName = `events/${uuidv4()}-${image.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: image.buffer,
        ContentType: image.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location;
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

    const newEvent = new Event({
      userId,
      title,
      description,
      date,
      time,
      location,
      coordinates,
      image: imageUrl,
      eventType,
      capacity,
      club,
      people,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
      ageRange,
      eventRules,
    });
    await newEvent.save();
    await EventParticipant.create({
      eventId: newEvent._id,
      userId,
      status: "approved",
      isCreator: true,
    });
    res
      .status(201)
      .json({ message: "Event created successfully", event: newEvent });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get events with flexible filtering
const getEvents = async (req, res) => {
  try {
    const {
      type = "all",
      latitude,
      longitude,
      limit = 10,
      maxDistance = 50,
    } = req.query;

    const userId = req.user.userId; // Get current user ID

    let events;
    let query = {};

    switch (type) {
      case "latest":
        // Get latest events (most recently created)
        events = await Event.find().sort({ date: 1 }).limit(parseInt(limit));
        break;

      case "nearest":
        // Get nearest events based on user location
        if (!latitude || !longitude) {
          return res.status(400).json({
            message: "Latitude and longitude are required for nearest events",
          });
        }

        try {
          const userLocation = {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          };

          console.log("Searching for events near:", userLocation);
          console.log("Max distance:", maxDistance, "km");

          events = await Event.find({
            coordinates: {
              $near: {
                $geometry: userLocation,
                $maxDistance: parseFloat(maxDistance) * 1000, // Convert km to meters
              },
            },
          }).limit(parseInt(limit));

          console.log(`Found ${events.length} events within ${maxDistance}km`);

          // Fallback if no nearby events
          // if (events.length === 0) {
          //   console.log(
          //     "No nearby events found, falling back to latest events"
          //   );
          //   events = await Event.find()
          //     .sort({ createdAt: -1 })
          //     .limit(parseInt(limit));
          // }
        } catch (geoError) {
          console.error("Geospatial query error:", geoError);
          // Fallback to latest events if geospatial query fails
          console.log("Falling back to latest events due to geospatial error");
          events = await Event.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        }
        break;

      default: // 'all'
        // Get all events
        events = await Event.find().limit(parseInt(limit));
        break;
    }

    // Add hotlist information to events
    const eventsWithHotlistInfo = await addHotlistInfoToEvents(events, userId);
    const eventsWithParticipantDetails = await addParticipantDetailsToEvents(
      eventsWithHotlistInfo,
      userId
    );

    res.status(200).json({ events: eventsWithParticipantDetails });
  } catch (error) {
    console.error("Error in getEvents:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      date,
      time,
      location,
      eventType,
      capacity,
      club,
      rsvpFriends,
      rsvpVerified,
      rsvpEveryone,
      joinRequest,
      coordinates,
      image: img,
      ageRange: ageRangeStr,
      eventRules,
    } = req.body;
    const image = req.file;
    console.log("image", image);
    console.log("title", title);
    console.log("img", img);

    // Handle people array from FormData
    let people = req.body.people;
    if (typeof people === "string") {
      people = [people];
    } else if (Array.isArray(people)) {
      people = people;
    } else {
      people = [];
    }

    let imageUrl = null;
    if (image && typeof img !== "string") {
      const fileName = `events/${uuidv4()}-${image.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: image.buffer,
        ContentType: image.mimetype,
      };
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location;
    }
    // Parse ageRange from JSON string to array
    let ageRange;
    try {
      ageRange = JSON.parse(ageRangeStr);
    } catch (error) {
      return res.status(400).json({ message: "Invalid age range format" });
    }
    const event = await Event.findByIdAndUpdate(
      id,
      {
        title,
        description,
        date,
        time,
        location,
        coordinates,
        image: typeof img === "string" ? img : imageUrl,
        eventType,
        capacity,
        club,
        people,
        rsvpFriends,
        rsvpVerified,
        rsvpEveryone,
        joinRequest,
        ageRange,
        eventRules,
      },
      { new: true }
    );
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json({ message: "Event updated successfully", event });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const event = await Event.findById(id).populate(
      "userId",
      "username profilePicture firstName lastName people"
    );
    const participants = await EventParticipant.find({ eventId: id });
    event.participants = participants;
    const eventWithHotlistInfo = await addHotlistInfoToEvent(event, userId);
    const eventWithParticipantDetails = await addParticipantDetailsToEvent(
      eventWithHotlistInfo,
      userId
    );
    res.status(200).json({ event: eventWithParticipantDetails });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const updateEventRules = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventRules } = req.body;
    const userId = req.user.userId;

    // Find the event and check if the user owns it
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You can only update your own events" });
    }

    // Update only the event rules
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { eventRules },
      { new: true }
    );

    res.status(200).json({
      message: "Event rules updated successfully",
      event: updatedEvent,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getEventsByUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tab = "all", date } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (tab === "createdByMe") {
      const query = { userId };
      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          query.date = filterDate;
        }
      }
      const events = await Event.find(query).populate(
        "userId",
        "username profilePicture firstName lastName people"
      );
      const eventsWithHotlistInfo = await addHotlistInfoToEvents(
        events,
        userId
      );
      const eventsWithParticipantDetails = await addParticipantDetailsToEvents(
        eventsWithHotlistInfo,
        userId
      );
      return res.status(200).json({
        events: eventsWithParticipantDetails,
        success: true,
      });
    } else if (tab === "joinedByMe") {
      const eventsParticipated = await EventParticipant.find({
        userId,
        status: "approved",
      });
      const eventsParticipatedIds = eventsParticipated.map(
        (event) => event.eventId
      );
      const query = {
        _id: { $in: eventsParticipatedIds },
      };
      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          query.date = filterDate;
        }
      }
      const events = await Event.find(query).populate(
        "userId",
        "username profilePicture firstName lastName people"
      );
      const eventsWithHotlistInfo = await addHotlistInfoToEvents(
        events,
        userId
      );
      const eventsWithParticipantDetails = await addParticipantDetailsToEvents(
        eventsWithHotlistInfo,
        userId
      );
      return res.status(200).json({
        events: eventsWithParticipantDetails,
        success: true,
      });
    } else if (tab === "all") {
      const eventsParticipated = await EventParticipant.find({
        userId,
        status: "approved",
      });

      const eventsParticipatedIds = eventsParticipated.map(
        (event) => event.eventId
      );

      const query = {
        _id: { $in: eventsParticipatedIds },
      };
      if (date && date !== "undefined" && date !== "null") {
        const filterDate = new Date(date);
        if (!isNaN(filterDate.getTime())) {
          query.date = filterDate;
        }
      }

      const events = await Event.find(query).populate(
        "userId",
        "username profilePicture firstName lastName people"
      );

      const eventsWithHotlistInfo = await addHotlistInfoToEvents(
        events,
        userId
      );

      const eventsWithParticipantDetails = await addParticipantDetailsToEvents(
        eventsWithHotlistInfo,
        userId
      );

      res
        .status(200)
        .json({ events: eventsWithParticipantDetails, success: true });
    }
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      success: false,
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  updateEvent,
  getEventById,
  updateEventRules,
  getEventsByUser,
};
