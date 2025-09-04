const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  state: {
    type: String,
  },
  country: {
    type: String,
  },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: false,
    },
  },
  image: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true,
  },
  ageRange: {
    type: [Number],
    required: true,
    validate: {
      validator: function (v) {
        return (
          Array.isArray(v) &&
          v.length === 2 &&
          typeof v[0] === "number" &&
          typeof v[1] === "number" &&
          v[0] >= 0 &&
          v[1] >= 0 &&
          v[0] <= v[1]
        );
      },
      message:
        "Age range must be an array of two numbers [minAge, maxAge] where minAge <= maxAge",
    },
  },
  people: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: "At least one people type must be selected",
    },
  },
  rsvpFriends: {
    type: Boolean,
    required: true,
  },
  rsvpVerified: {
    type: Boolean,
    required: true,
  },
  rsvpEveryone: {
    type: Boolean,
    required: true,
  },
  joinRequest: {
    type: Boolean,
    required: true,
  },
  eventRules: {
    type: String,
  },
});

eventSchema.virtual("participants", {
  ref: "EventParticipant",
  localField: "_id",
  foreignField: "eventId",
});

eventSchema.set("toJSON", { virtuals: true });
eventSchema.set("toObject", { virtuals: true });

// Add geospatial index for coordinates field
eventSchema.index({ coordinates: "2dsphere" });

// Ensure the index is created when the model is first used
const Event = mongoose.model("Event", eventSchema);

// Create the geospatial index if it doesn't exist
Event.createIndexes().catch((err) => {
  console.error("Error creating Event indexes:", err);
});

module.exports = Event;
