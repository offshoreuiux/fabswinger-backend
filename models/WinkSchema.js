const mongoose = require("mongoose");

const WinkSchema = new mongoose.Schema(
  {
    winkerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    winkedProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wink", WinkSchema);
