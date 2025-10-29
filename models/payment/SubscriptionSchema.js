const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isFreeLifeTime: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
      default: null,
      required: false,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      required: false,
    },
    priceId: {
      type: String,
      default: null,
      required: false,
    },
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "unpaid"],
      default: "active",
    },
    currentPeriodStart: {
      type: Date,
      default: null,
      required: false,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
      required: false,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Object,
      default: null,
      required: false,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
