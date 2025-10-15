const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdFor: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    reportType: {
      type: String,
      required: true,
      enum: ["User", "Post", "ForumPost"],
    },
    reportReason: {
      type: String,
      required: true,
      trim: true,
    },
    reportDetails: {
      type: String,
      required: true,
      trim: true,
    },
    reportedContent: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "reportType",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
