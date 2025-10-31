const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
  registerAffiliate,
  getAffiliateFunds,
  payoutAffiliate,
  getStripeAccountLink,
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

// Register as affiliate
router.post("/affiliate/register", authenticateToken, registerAffiliate);

//  Get affiliate funds
router.get("/affiliate/funds", authenticateToken, getAffiliateFunds);

// Payout affiliate
router.post("/affiliate/payout", authenticateToken, payoutAffiliate);

// Get Stripe account link (for completing or editing account)
router.get(
  "/affiliate/stripe/account-link",
  authenticateToken,
  getStripeAccountLink
);

module.exports = router;
