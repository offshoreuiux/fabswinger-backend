const Event = require("../../models/event/EventSchema");
const EventHotlist = require("../../models/hotlist/EventHotlistSchema");
const EventParticipant = require("../../models/event/EventParticipantSchema");
const User = require("../../models/user/UserSchema");
const Friends = require("../../models/FriendRequestSchema");
const SubscriptionSchema = require("../../models/payment/SubscriptionSchema");
// const Club = require("../models/ClubSchema");
const { v4: uuidv4 } = require("uuid");
const { s3 } = require("../../utils/s3");
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
    }).populate("userId", "username profileImage firstName lastName people");
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
      region,
    } = req.body;

    //Check subscription status
    const subscription = await SubscriptionSchema.findOne({ userId });
    console.log("subscription?.status:", subscription?.status);

    if (!subscription || subscription.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "You need an active subscription to create events.",
      });
    }

    //Count user's active events (not completed)
    const userEvents = await Event.find({ userId });
    const now = new Date();

    const activeEvents = userEvents.filter((event) => {
      const eventDateTime = new Date(event.date);
      if (event.time) {
        const [hours, minutes] = event.time.split(":").map(Number);
        eventDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      }
      // Event is considered active if it hasn't passed yet
      return eventDateTime >= now;
    });

    const count = activeEvents.length;
    console.log("Event Count : ", count);

    //Apply event creation limits
    if (subscription.status === "active" && count >= 5) {
      return res.status(403).json({
        success: false,
        message:
          "Event limit reached. You can have up to 5 active events at a time.",
      });
    }

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
    const image = req.file;

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
      ageRange === undefined ||
      region === undefined
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
      region,
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
      page = 1,
      limit = 10,
      maxDistance = 100,
      search = "",
      filter = {},
      sortBy = "",
      seeAll = false,
    } = req.query;
    const numericLimit = parseInt(limit);
    console.log("maxDistance", maxDistance);
    const numericPage = parseInt(page);
    const skip = (numericPage - 1) * numericLimit;

    const userId = req.user.userId; // Get current user ID
    console.log("filter", filter);

    let events;
    let totalCount = 0;
    let query = {};

    // Parse filter object if it's a string
    let parsedFilter = {};
    if (typeof filter === "string") {
      try {
        parsedFilter = JSON.parse(filter);
      } catch (e) {
        parsedFilter = {};
      }
    } else {
      parsedFilter = filter;
    }

    // Helper function to build filter query
    const buildFilterQuery = async (baseQuery = {}) => {
      const {
        region,
        type: eventType,
        distance,
        discover,
        sort,
      } = parsedFilter;
      let filterQuery = { ...baseQuery };

      if (region) filterQuery.region = region;
      if (eventType && eventType !== "any") filterQuery.eventType = eventType;

      if (distance && distance !== "all") {
        const currentUser = await User.findById(userId).select("geoLocation");
        const userCoordinates = currentUser?.geoLocation?.coordinates;

        if (userCoordinates) {
          let maxDistance = 0;
          if (distance === "25") maxDistance = 25;
          else if (distance === "50") maxDistance = 50;
          else if (distance === "75") maxDistance = 75;
          else if (distance === "100") maxDistance = 100;
          else if (distance === "150") maxDistance = 150;

          if (maxDistance > 0) {
            const distanceMeters = Math.round(maxDistance * 1609.34);
            filterQuery.coordinates = {
              $geoWithin: {
                $centerSphere: [userCoordinates, distanceMeters / 6378137],
              },
            };
          }
        }
      }

      if (discover && discover !== "discover") {
        if (discover === "scheduled" || discover === "history") {
          const participated = await EventParticipant.find({
            userId,
            status: "approved",
          }).select("eventId");
          const participatedIds = participated.map((e) => e.eventId);
          filterQuery._id = { $in: participatedIds };
          if (discover === "scheduled") {
            filterQuery.date = { $gte: new Date() };
          } else {
            filterQuery.date = { $lt: new Date() };
          }
        }
      }

      // By default, exclude past events unless explicitly requesting history
      if (!discover || discover !== "history") {
        filterQuery.date = { $gte: new Date() };
      }

      return filterQuery;
    };

    switch (type) {
      case "latest": {
        if (seeAll === "true" || seeAll === true) {
          const filterQuery = await buildFilterQuery();
          const { sort } = parsedFilter;

          let sortQuery = { createdAt: -1 }; // Default sort
          if (sort === "most_popular") {
            // Use aggregation for participant count sorting
            const pipeline = [
              {
                $lookup: {
                  from: "eventparticipants",
                  let: { eventId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$eventId", "$$eventId"] },
                            { $eq: ["$status", "approved"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "participants",
                },
              },
              {
                $addFields: {
                  participantCount: {
                    $size: { $ifNull: ["$participants", []] },
                  },
                },
              },
              {
                $match: {
                  title: { $regex: search, $options: "i" },
                  ...filterQuery,
                },
              },
              {
                $sort: { participantCount: -1, date: 1 },
              },
              { $skip: skip },
              { $limit: numericLimit },
              {
                $project: {
                  participants: 0,
                },
              },
            ];

            const countPipeline = [
              {
                $match: {
                  title: { $regex: search, $options: "i" },
                  ...filterQuery,
                },
              },
              { $count: "count" },
            ];

            const [aggResults, countResults] = await Promise.all([
              Event.aggregate(pipeline),
              Event.aggregate(countPipeline),
            ]);
            events = aggResults.map((result) => new Event(result));
            totalCount = countResults?.[0]?.count || 0;
          } else if (sort === "nearest") {
            const currentUser = await User.findById(userId).select(
              "geoLocation"
            );
            const userCoordinates = currentUser?.geoLocation?.coordinates;

            if (userCoordinates) {
              const pipeline = [
                {
                  $geoNear: {
                    near: { type: "Point", coordinates: userCoordinates },
                    distanceField: "distance",
                    spherical: true,
                    key: "coordinates",
                  },
                },
                {
                  $match: {
                    ...filterQuery,
                    title: { $regex: search, $options: "i" },
                  },
                },
                { $skip: skip },
                { $limit: numericLimit },
              ];
              events = (await Event.aggregate(pipeline)).map(
                (result) => new Event(result)
              );
              totalCount = await Event.countDocuments({
                ...filterQuery,
                title: { $regex: search, $options: "i" },
              });
            } else {
              // Fallback to regular query if no coordinates
              totalCount = await Event.countDocuments({
                title: { $regex: search, $options: "i" },
                ...filterQuery,
              });
              events = await Event.find({
                title: { $regex: search, $options: "i" },
                ...filterQuery,
              })
                .sort(sortQuery)
                .skip(skip)
                .limit(numericLimit);
            }
          } else {
            totalCount = await Event.countDocuments({
              title: { $regex: search, $options: "i" },
              ...filterQuery,
            });
            events = await Event.find({
              title: { $regex: search, $options: "i" },
              ...filterQuery,
            })
              .sort(sortQuery)
              .skip(skip)
              .limit(numericLimit);
          }
        } else {
          // Exclude past events by default
          const now = new Date();
          totalCount = await Event.countDocuments({ date: { $gte: now } });
          events = await Event.find({ date: { $gte: now } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit);
        }
        break;
      }

      case "popular": {
        if (seeAll === "true" || seeAll === true) {
          const filterQuery = await buildFilterQuery();
          const { sort } = parsedFilter;

          let sortStage = { participantCount: -1, date: -1 }; // Default sort
          if (sort === "nearest") {
            const currentUser = await User.findById(userId).select(
              "geoLocation"
            );
            const userCoordinates = currentUser?.geoLocation?.coordinates;

            if (userCoordinates) {
              const pipeline = [
                {
                  $geoNear: {
                    near: { type: "Point", coordinates: userCoordinates },
                    distanceField: "distance",
                    spherical: true,
                    key: "coordinates",
                  },
                },
                {
                  $lookup: {
                    from: "eventparticipants",
                    let: { eventId: "$_id" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$eventId", "$$eventId"] },
                              { $eq: ["$status", "approved"] },
                            ],
                          },
                        },
                      },
                    ],
                    as: "participants",
                  },
                },
                {
                  $addFields: {
                    participantCount: {
                      $size: { $ifNull: ["$participants", []] },
                    },
                  },
                },
                {
                  $match: {
                    title: { $regex: search, $options: "i" },
                    ...filterQuery,
                  },
                },
                { $sort: { distance: 1, participantCount: -1 } },
                { $skip: skip },
                { $limit: numericLimit },
                { $project: { participants: 0 } },
              ];

              const countPipeline = [
                {
                  $match: {
                    title: { $regex: search, $options: "i" },
                    ...filterQuery,
                  },
                },
                { $count: "count" },
              ];

              const [aggResults, countResults] = await Promise.all([
                Event.aggregate(pipeline),
                Event.aggregate(countPipeline),
              ]);
              events = aggResults.map((result) => new Event(result));
              totalCount = countResults?.[0]?.count || 0;
            } else {
              // Fallback to regular popular sorting if no coordinates
              const pipeline = [
                {
                  $lookup: {
                    from: "eventparticipants",
                    let: { eventId: "$_id" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$eventId", "$$eventId"] },
                              { $eq: ["$status", "approved"] },
                            ],
                          },
                        },
                      },
                    ],
                    as: "participants",
                  },
                },
                {
                  $addFields: {
                    participantCount: {
                      $size: { $ifNull: ["$participants", []] },
                    },
                  },
                },
                {
                  $match: {
                    title: { $regex: search, $options: "i" },
                    ...filterQuery,
                  },
                },
                { $sort: sortStage },
                { $skip: skip },
                { $limit: numericLimit },
                { $project: { participants: 0 } },
              ];

              const countPipeline = [
                {
                  $match: {
                    title: { $regex: search, $options: "i" },
                    ...filterQuery,
                  },
                },
                { $count: "count" },
              ];

              const [aggResults, countResults] = await Promise.all([
                Event.aggregate(pipeline),
                Event.aggregate(countPipeline),
              ]);
              events = aggResults.map((result) => new Event(result));
              totalCount = countResults?.[0]?.count || 0;
            }
          } else {
            const pipeline = [
              {
                $lookup: {
                  from: "eventparticipants",
                  let: { eventId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$eventId", "$$eventId"] },
                            { $eq: ["$status", "approved"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "participants",
                },
              },
              {
                $addFields: {
                  participantCount: {
                    $size: { $ifNull: ["$participants", []] },
                  },
                },
              },
              {
                $match: {
                  title: { $regex: search, $options: "i" },
                  ...filterQuery,
                },
              },
              { $sort: sortStage },
              { $skip: skip },
              { $limit: numericLimit },
              { $project: { participants: 0 } },
            ];
            const countPipeline = [
              {
                $match: {
                  title: { $regex: search, $options: "i" },
                  ...filterQuery,
                },
              },
              { $count: "count" },
            ];
            const [aggResults, countResults] = await Promise.all([
              Event.aggregate(pipeline),
              Event.aggregate(countPipeline),
            ]);
            events = aggResults.map((result) => new Event(result));
            totalCount = countResults?.[0]?.count || 0;
          }
        } else {
          const pipeline = [
            {
              $lookup: {
                from: "eventparticipants",
                let: { eventId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$eventId", "$$eventId"] },
                          { $eq: ["$status", "approved"] },
                        ],
                      },
                    },
                  },
                ],
                as: "participants",
              },
            },
            {
              $addFields: {
                participantCount: { $size: { $ifNull: ["$participants", []] } },
              },
            },
            {
              $match: {
                title: { $regex: search, $options: "i" },
                date: { $gte: new Date() },
              },
            },
            { $sort: { participantCount: -1, date: -1 } },
            { $skip: skip },
            { $limit: numericLimit },
            { $project: { participants: 0 } },
          ];
          const countPipeline = [
            {
              $match: {
                title: { $regex: search, $options: "i" },
                date: { $gte: new Date() },
              },
            },
            { $count: "count" },
          ];
          const [aggResults, countResults] = await Promise.all([
            Event.aggregate(pipeline),
            Event.aggregate(countPipeline),
          ]);
          events = aggResults.map((result) => new Event(result));
          totalCount = countResults?.[0]?.count || 0;
        }
        break;
      }

      case "nearest":
        // Get nearest events based on user location
        if (!latitude || !longitude) {
          return res.status(400).json({
            message: "Latitude and longitude are required for nearest events",
          });
        }

        try {
          const MILES_TO_METERS = 1609.34;
          const EARTH_RADIUS_METERS = 6378137;
          const userLocation = {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          };
          const maxDistanceMiles = parseFloat(maxDistance);
          const maxDistanceMeters = maxDistanceMiles * MILES_TO_METERS;

          let additionalFilters = {};
          let sortOption = sortBy;
          if (seeAll === "true" || seeAll === true) {
            additionalFilters = await buildFilterQuery();
            const { sort } = parsedFilter;
            if (sort && sort !== "all") {
              sortOption = sort;
            }
          } else {
            // Exclude past events when not in seeAll mode
            additionalFilters = { date: { $gte: new Date() } };
          }

          const geoPipeline = [
            {
              $geoNear: {
                near: userLocation,
                distanceField: "distanceInMiles",
                spherical: true,
                key: "coordinates",
                maxDistance: maxDistanceMeters,
                distanceMultiplier: 0.000621371, // meters -> miles
              },
            },
            {
              $match: {
                title: { $regex: search, $options: "i" },
                ...additionalFilters,
              },
            },
          ];

          if (sortOption === "participants" || sortOption === "most_popular") {
            geoPipeline.push(
              {
                $lookup: {
                  from: "eventparticipants",
                  let: { eventId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$eventId", "$$eventId"] },
                            { $eq: ["$status", "approved"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "participants",
                },
              },
              {
                $addFields: {
                  participantCount: {
                    $size: { $ifNull: ["$participants", []] },
                  },
                },
              },
              { $sort: { participantCount: -1, distanceInMiles: 1 } },
              { $project: { participants: 0 } }
            );
          } else {
            geoPipeline.push({ $sort: { distanceInMiles: 1 } });
          }

          geoPipeline.push({ $skip: skip }, { $limit: numericLimit });

          const distanceMeters = maxDistanceMeters;
          const [aggResults, countResults] = await Promise.all([
            Event.aggregate(geoPipeline),
            Event.countDocuments({
              coordinates: {
                $geoWithin: {
                  $centerSphere: [
                    [userLocation.coordinates[0], userLocation.coordinates[1]],
                    distanceMeters / EARTH_RADIUS_METERS,
                  ],
                },
              },
              title: { $regex: search, $options: "i" },
              ...additionalFilters,
            }),
          ]);
          events = aggResults.map((result) => new Event(result));
          totalCount = countResults || 0;

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
          totalCount = await Event.countDocuments();
          events = await Event.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit);
        }
        break;

      default: // 'all'
        // Get all events

        let filterQuery = {};
        const { region, type, distance, discover, sort } = JSON.parse(filter);

        if (region) filterQuery.region = region;
        if (type && type !== "any") filterQuery.eventType = type;
        if (distance && distance !== "all") {
          const currentUser = await User.findById(userId).select("geoLocation");
          const userCoordinates = currentUser?.geoLocation?.coordinates;

          if (userCoordinates) {
            let maxDistance = 0;
            if (distance === "25") maxDistance = 25;
            else if (distance === "50") maxDistance = 50;
            else if (distance === "75") maxDistance = 75;
            else if (distance === "100") maxDistance = 100;
            else if (distance === "150") maxDistance = 150;

            if (maxDistance > 0) {
              const distanceMeters = Math.round(maxDistance * 1609.34);
              filterQuery.coordinates = {
                $geoWithin: {
                  $centerSphere: [userCoordinates, distanceMeters / 6378137],
                },
              };
            }
          }
        }
        if (discover) {
          // For scheduled/history, restrict to events the user participated in
          if (discover === "scheduled" || discover === "history") {
            const participated = await EventParticipant.find({
              userId,
              status: "approved",
            }).select("eventId");
            const participatedIds = participated.map((e) => e.eventId);
            filterQuery._id = { $in: participatedIds };
            if (discover === "scheduled") {
              filterQuery.date = { $gte: new Date() };
            } else {
              filterQuery.date = { $lt: new Date() };
            }
          }
        }
        // Exclude past events by default when not requesting history
        if (!discover || discover !== "history") {
          filterQuery.date = { $gte: new Date() };
        }
        if (sort === "most_popular") {
          // Use aggregation to count participants and sort by participant count
          const pipeline = [
            {
              $lookup: {
                from: "eventparticipants",
                let: { eventId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$eventId", "$$eventId"] },
                          { $eq: ["$status", "approved"] },
                        ],
                      },
                    },
                  },
                ],
                as: "participants",
              },
            },
            {
              $addFields: {
                participantCount: { $size: { $ifNull: ["$participants", []] } },
              },
            },
            {
              $match: {
                title: { $regex: search, $options: "i" },
                ...filterQuery,
              },
            },
            {
              $sort: { participantCount: -1, date: 1 }, // Sort by participant count desc, then by date asc
            },
            { $skip: parseInt(skip) },
            { $limit: parseInt(limit) },
            {
              $project: {
                participants: 0, // Remove the participants array from final result
              },
            },
          ];

          const [aggregationResults, countAgg] = await Promise.all([
            Event.aggregate(pipeline),
            Event.aggregate([
              {
                $match: {
                  title: { $regex: search, $options: "i" },
                  ...filterQuery,
                },
              },
              { $count: "count" },
            ]),
          ]);
          // Convert aggregation results back to Mongoose documents
          events = aggregationResults.map((result) => new Event(result));
          totalCount = countAgg?.[0]?.count || 0;
        } else {
          if (sort && sort !== "all") {
            if (sort === "nearest") {
              const currentUser = await User.findById(userId).select(
                "geoLocation"
              );
              const userCoordinates = currentUser?.geoLocation?.coordinates;

              if (!userCoordinates) {
                return res
                  .status(400)
                  .json({ message: "User coordinates not found" });
              }

              const aggregationResults = await Event.aggregate([
                {
                  $geoNear: {
                    near: { type: "Point", coordinates: userCoordinates },
                    distanceField: "distance",
                    spherical: true,
                    key: "coordinates",
                  },
                },
                {
                  $match: {
                    ...filterQuery,
                    title: { $regex: search, $options: "i" },
                  },
                },
                { $skip: parseInt(skip) },
                { $limit: parseInt(limit) },
              ]);
              // Convert aggregation results back to Mongoose documents
              events = aggregationResults.map((result) => new Event(result));
            } else if (sort === "recently_created") {
              filterQuery.createdAt = {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              };
            }
          }

          totalCount = await Event.countDocuments({
            title: { $regex: search, $options: "i" },
            ...filterQuery,
          });
          events = await Event.find({
            title: { $regex: search, $options: "i" },
            ...filterQuery,
          })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(numericLimit);
          console.log("events", events);
        }
        break;
    }

    // Filter events based on visibility rules

    // Get user's verification status and friends list
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isUserVerified = user.isVerified || false;
    let userFriends = [];

    // Get user's friends list for friend-only events
    const userFriendships = await Friends.find({
      $or: [
        { sender: userId, status: "accepted" },
        { receiver: userId, status: "accepted" },
      ],
    });

    // Extract friend IDs (excluding the current user)
    userFriends = userFriendships.map((friendship) => {
      if (friendship.sender.toString() === userId.toString()) {
        return friendship.receiver.toString();
      } else {
        return friendship.sender.toString();
      }
    });

    // Filter events based on visibility rules
    const filteredEvents = events.filter((event) => {
      // If user is the creator, always show the event
      if (event.userId.toString() === userId.toString()) {
        console.log(`Event ${event.title} visible to creator`);
        return true;
      }

      // If rsvpEveryone is true, show to everyone
      if (event.rsvpEveryone) {
        console.log(`Event ${event.title} visible to everyone`);
        return true;
      }

      // If rsvpFriends is true, only show to creator's friends
      if (event.rsvpFriends) {
        const isFriend = userFriends.includes(event.userId.toString());
        console.log(
          `Event ${event.title} friend-only, user is friend: ${isFriend}`
        );
        return isFriend;
      }

      // If rsvpVerified is true, only show to verified users
      if (event.rsvpVerified) {
        console.log(
          `Event ${event.title} verified-only, user verified: ${isUserVerified}`
        );
        return isUserVerified;
      }

      // Default: show to everyone (no restrictions set)
      console.log(`Event ${event.title} visible to all (no restrictions)`);
      return true;
    });

    const eventsWithHotlistInfo = await addHotlistInfoToEvents(
      filteredEvents,
      userId
    );
    const eventsWithParticipantDetails = await addParticipantDetailsToEvents(
      eventsWithHotlistInfo,
      userId
    );

    // Ensure totalCount does not include past events unless discover === "history"
    try {
      const isHistoryDiscover = parsedFilter?.discover === "history";
      if (!isHistoryDiscover) {
        const safeFilterQuery = await buildFilterQuery();
        const titleQuery = { title: { $regex: search, $options: "i" } };
        const safeCount = await Event.countDocuments({
          ...safeFilterQuery,
          ...titleQuery,
        });
        totalCount = safeCount;
      }
    } catch (_) {
      // Fallback to existing totalCount if any error occurs
    }

    const totalPages = Math.ceil((totalCount || 0) / numericLimit) || 0;
    const hasMore = numericPage < totalPages;
    res.status(200).json({
      events: eventsWithParticipantDetails,
      page: numericPage,
      limit: numericLimit,
      total: totalCount,
      totalPages,
      hasMore,
    });
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
      image: img,
      ageRange: ageRangeStr,
      eventRules,
      region,
    } = req.body;
    const image = req.file;

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
    let coordinates = null;
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          location
        )}&limit=1`
      );
      const geocodeData = await geocodeResponse.json();
      coordinates = {
        type: "Point",
        coordinates: [
          parseFloat(geocodeData[0].lon),
          parseFloat(geocodeData[0].lat),
        ],
      };
    } catch (geocodeError) {
      console.log("Geocoding failed:", geocodeError.message);
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
        region,
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
    // console.log("participants", participants);
    event.participants = participants;
    const eventWithHotlistInfo = await addHotlistInfoToEvent(event, userId);
    const eventWithParticipantDetails = await addParticipantDetailsToEvent(
      eventWithHotlistInfo,
      userId
    );
    console.log("eventWithParticipantDetails", eventWithParticipantDetails);
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
    const userId = req.query.userId;
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
        userId: { $ne: userId },
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

const getEventsByDistance = async (req, res) => {
  try {
    const { distance, latitude, longitude, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    if (!distance || !latitude || !longitude) {
      return res.status(400).json({
        message: "Distance (in miles), latitude, and longitude are required",
      });
    }

    const distanceInMiles = parseFloat(distance);
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(distanceInMiles) || isNaN(userLat) || isNaN(userLon)) {
      return res.status(400).json({
        message: "Invalid distance, latitude, or longitude values",
      });
    }

    if (distanceInMiles <= 0) {
      return res.status(400).json({
        message: "Distance must be greater than 0",
      });
    }

    // Convert miles to radians (Earth's radius is approximately 3959 miles)
    const distanceInRadians = distanceInMiles / 3959;

    const skip = (page - 1) * limit;

    // Use aggregation to get events within distance with proper distance calculation
    const events = await Event.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [userLon, userLat],
          },
          distanceField: "distanceInMiles",
          spherical: true,
          key: "coordinates",
          maxDistance: distanceInRadians,
          query: {
            coordinates: { $exists: true, $ne: null },
          },
        },
      },
      {
        $addFields: {
          // Convert distance from radians to miles for display
          distanceInMiles: {
            $round: [{ $multiply: ["$distanceInMiles", 3959] }, 2],
          },
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    // Get total count for pagination
    const totalCount = await Event.countDocuments({
      coordinates: {
        $geoWithin: {
          $centerSphere: [[userLon, userLat], distanceInRadians],
        },
      },
    });

    // Add hotlist and participant information
    const eventsWithDetails = await addHotlistInfoToEvents(events, userId);
    const eventsWithParticipants = await addParticipantDetailsToEvents(
      eventsWithDetails,
      userId
    );

    // Filter events based on visibility rules
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isUserVerified = user.verified || false;
    let userFriends = [];

    // Get user's friends list for friend-only events
    const userFriendships = await Friends.find({
      $or: [
        { sender: userId, status: "accepted" },
        { receiver: userId, status: "accepted" },
      ],
    });

    // Extract friend IDs (excluding the current user)
    userFriends = userFriendships.map((friendship) => {
      if (friendship.sender.toString() === userId.toString()) {
        return friendship.receiver.toString();
      } else {
        return friendship.sender.toString();
      }
    });

    // Filter events based on visibility rules
    const filteredEvents = eventsWithParticipants.filter((event) => {
      // If rsvpEveryone is true, show to everyone
      if (event.rsvpEveryone) {
        return true;
      }

      // If user is the creator, always show the event
      if (event.userId.toString() === userId.toString()) {
        return true;
      }

      // If rsvpFriends is true, only show to creator's friends
      if (event.rsvpFriends) {
        const isFriend = userFriends.includes(event.userId.toString());
        return isFriend;
      }

      // If rsvpVerified is true, only show to verified users
      if (event.rsvpVerified) {
        return isUserVerified;
      }

      // Default: show to everyone
      return true;
    });

    res.status(200).json({
      events: filteredEvents,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
      searchRadius: distanceInMiles,
      userLocation: { latitude: userLat, longitude: userLon },
    });
  } catch (error) {
    console.error("Error getting events by distance:", error);
    res.status(500).json({
      message: "Failed to get events by distance",
      error: error.message,
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
  getEventsByDistance,
};
