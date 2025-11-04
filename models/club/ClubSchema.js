const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    // Geo Location for Nearby Filter
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
    },
    clubEmail: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    people: {
      type: [String],
      required: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isVerified: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "applied"],
      default: "pending",
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

clubSchema.virtual("events", {
  ref: "Event",
  localField: "_id",
  foreignField: "club",
});

clubSchema.virtual("meets", {
  ref: "Meet",
  localField: "_id",
  foreignField: "club",
});

clubSchema.index({ name: "text", description: "text" });
clubSchema.index({ geoLocation: "2dsphere" });

clubSchema.set("toJSON", { virtuals: true });
clubSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Club", clubSchema);
