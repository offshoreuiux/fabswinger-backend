const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  url: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  clubEmail: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  people: {
    type: [String],
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  image: {
    type: String,
    required: true,
  },
});

clubSchema.virtual("events", {
  ref: "Event",
  localField: "_id",
  foreignField: "club",
});

clubSchema.set("toJSON", { virtuals: true });
clubSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Club", clubSchema);
