const mongoose = require("mongoose");

const VerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "user";
      },
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: function () {
        return this.type === "club";
      },
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationImage: {
      type: String,
      required: function () {
        return this.type === "user";
      },
    },
    type: {
      type: String,
      enum: ["user", "club"],
      required: true,
    },
    clubName: {
      type: String,
      required: function () {
        return this.type === "club";
      },
    },
    clubEmail: {
      type: String,
      required: function () {
        return this.type === "club";
      },
    },
    clubPhone: {
      type: String,
      required: function () {
        return this.type === "club";
      },
    },
    clubWebsite: {
      type: String,
      required: function () {
        return this.type === "club";
      },
    },
    businessLicense: {
      type: String,
      required: function () {
        return this.type === "club";
      },
    },
  },
  { timestamps: true }
);

// Index for efficient queries
VerificationSchema.index({ userId: 1 });
VerificationSchema.index({ clubId: 1 });
VerificationSchema.index({ status: 1 });
VerificationSchema.index({ type: 1 });
VerificationSchema.index({ userId: 1, type: 1 });
VerificationSchema.index({ clubId: 1, type: 1 });

// Virtual for verification age
VerificationSchema.virtual("verificationAge").get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Method to check if verification is expired (e.g., older than 30 days)
VerificationSchema.methods.isExpired = function (expiryDays = 30) {
  const expiryTime = expiryDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
  return Date.now() - this.createdAt.getTime() > expiryTime;
};

// Method to get verification status with additional info
VerificationSchema.methods.getStatusInfo = function () {
  return {
    status: this.status,
    createdAt: this.createdAt,
    verificationImage: this.verificationImage,
    isExpired: this.isExpired(),
    type: this.type,
  };
};

module.exports = mongoose.model("Verification", VerificationSchema);
