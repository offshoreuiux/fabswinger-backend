const mongoose = require("mongoose");

const meetParticipantSchema = new mongoose.Schema(
  {
    meetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meet",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["applied", "approved"],
      default: "applied",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one participant per user per event
meetParticipantSchema.index({ meetId: 1, userId: 1 }, { unique: true });

// Indexes for better query performance
meetParticipantSchema.index({ meetId: 1, status: 1 });
meetParticipantSchema.index({ userId: 1, status: 1 });

// Virtual for participant count by status
meetParticipantSchema.statics.getParticipantCounts = async function (meetId) {
  const counts = await this.aggregate([
    { $match: { meetId: mongoose.Types.ObjectId(meetId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const result = {
    applied: 0,
    approved: 0,
  };

  counts.forEach((item) => {
    result[item._id] = item.count;
  });

  return result;
};

// Pre-save middleware to update timestamps
meetParticipantSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = new Date();

    if (this.status === "approved" && !this.approvedAt) {
      this.approvedAt = now;
    }
  }

  next();
});

module.exports = mongoose.model("MeetParticipant", meetParticipantSchema);
