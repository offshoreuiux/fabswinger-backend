const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
} = require("../../controllers/payment/subscriptionController");
const { authenticateToken } = require("../../middleware");

// Create checkout session
router.post(
  "/create-checkout-session",
  authenticateToken,
  createCheckoutSession
);

// Get subscription status
router.get("/status", authenticateToken, getSubscriptionStatus);

// Cancel subscription
router.post("/cancel", authenticateToken, cancelSubscription);

// Reactivate subscription
router.post("/reactivate", authenticateToken, reactivateSubscription);

module.exports = router;
