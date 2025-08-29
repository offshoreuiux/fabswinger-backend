const mongoose = require("mongoose");

const eventParticipantSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
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
    isCreator: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one participant per user per event
eventParticipantSchema.index({ eventId: 1, userId: 1 }, { unique: true });

// Indexes for better query performance
eventParticipantSchema.index({ eventId: 1, status: 1 });
eventParticipantSchema.index({ userId: 1, status: 1 });

// Virtual for participant count by status
eventParticipantSchema.statics.getParticipantCounts = async function (eventId) {
  const counts = await this.aggregate([
    { $match: { eventId: mongoose.Types.ObjectId(eventId) } },
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
eventParticipantSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = new Date();

    if (this.status === "approved" && !this.approvedAt) {
      this.approvedAt = now;
    }
  }

  next();
});

module.exports = mongoose.model("EventParticipant", eventParticipantSchema);
