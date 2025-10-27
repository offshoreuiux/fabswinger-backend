const express = require("express");
const router = express.Router();
const {
  handleStripeWebhook,
} = require("../../controllers/payment/webhookController");

// Stripe webhook endpoint (no authentication needed)
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

module.exports = router;
