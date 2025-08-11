const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    images: [
      {
        type: String, // S3 URL
      },
    ],
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

postSchema.index({ location: "2dsphere" });
postSchema.index({ privacy: 1 });
postSchema.index({ userId: 1, privacy: 1 });

module.exports = mongoose.model("Post", postSchema);
