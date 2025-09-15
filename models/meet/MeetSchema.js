const mongoose = require("mongoose");

const meetSchema = new mongoose.Schema(
  {
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
    meetType: {
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
  },
  {
    timestamps: true,
  }
);

meetSchema.virtual("participants", {
  ref: "MeetParticipant",
  localField: "_id",
  foreignField: "meetId",
});

// Add geospatial index for coordinates field
meetSchema.index({ coordinates: "2dsphere" });

meetSchema.index({ userId: 1 });

meetSchema.index({ people: 1 });

meetSchema.index({ meetType: 1 });

meetSchema.set("toJSON", { virtuals: true });
meetSchema.set("toObject", { virtuals: true });

// Ensure the index is created when the model is first used
const Meet = mongoose.model("Meet", meetSchema);

// Create the geospatial index if it doesn't exist
Meet.createIndexes().catch((err) => {
  console.error("Error creating Meet indexes:", err);
});

module.exports = Meet;
