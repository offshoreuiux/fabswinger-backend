const subscriptionSchema = require("../../models/payment/SubscriptionSchema");
const User = require("../../models/user/UserSchema");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("Received webhook event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

const handleCheckoutSessionCompleted = async (session) => {
  console.log("Checkout session completed:", session.id);

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in session metadata");
    return;
  }

  // Retrieve the subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription
  );

  console.log("=== SUBSCRIPTION DEBUG ===");
  console.log("Subscription ID:", subscription.id);
  console.log("Billing mode:", subscription.billing_mode?.type);
  console.log("Billing cycle anchor:", subscription.billing_cycle_anchor);
  console.log("Start date:", subscription.start_date);
  console.log(
    "Current period start (legacy):",
    subscription.current_period_start
  );
  console.log("Current period end (legacy):", subscription.current_period_end);
  console.log("Cancel at period end:", subscription.cancel_at_period_end);

  // Handle different billing modes
  let currentPeriodStart, currentPeriodEnd;

  if (subscription.billing_mode?.type === "flexible") {
    // For flexible billing, use billing_cycle_anchor as the start
    currentPeriodStart = subscription.billing_cycle_anchor;
    // Calculate end date based on plan interval
    const plan = subscription.plan || subscription.items.data[0].price;
    const intervalDays =
      plan.interval === "month" ? 30 : plan.interval === "year" ? 365 : 1;
    currentPeriodEnd = currentPeriodStart + intervalDays * 24 * 60 * 60;

    console.log("Using flexible billing mode");
    console.log(
      "Calculated period start:",
      new Date(currentPeriodStart * 1000)
    );
    console.log("Calculated period end:", new Date(currentPeriodEnd * 1000));
  } else {
    // For standard billing, use the legacy fields
    currentPeriodStart = subscription.current_period_start;
    currentPeriodEnd = subscription.current_period_end;

    console.log("Using standard billing mode");
    console.log(
      "Period start:",
      currentPeriodStart ? new Date(currentPeriodStart * 1000) : "null"
    );
    console.log(
      "Period end:",
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : "null"
    );
  }

  // Validate that we have period data
  if (!currentPeriodStart || !currentPeriodEnd) {
    console.error("ERROR: Unable to determine subscription periods!");
    console.error("Billing mode:", subscription.billing_mode?.type);
    console.error("Billing cycle anchor:", subscription.billing_cycle_anchor);
    console.error("Start date:", subscription.start_date);
    throw new Error("Cannot determine subscription periods");
  }

  // Create subscription record in database
  await subscriptionSchema.create({
    userId: userId,
    isFreeLifeTime: false,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: subscription.id,
    priceId: subscription.items.data[0].price.id,
    status: subscription.status,
    currentPeriodStart: new Date(currentPeriodStart * 1000),
    currentPeriodEnd: new Date(currentPeriodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: {
      sessionId: session.id,
      created_at: new Date().toISOString(),
      billing_mode: subscription.billing_mode?.type,
      debug_info: {
        raw_billing_cycle_anchor: subscription.billing_cycle_anchor,
        raw_start_date: subscription.start_date,
        raw_current_period_start: subscription.current_period_start,
        raw_current_period_end: subscription.current_period_end,
        calculated_period_start: currentPeriodStart,
        calculated_period_end: currentPeriodEnd,
      },
    },
  });
  console.log("=== END SUBSCRIPTION DEBUG ===");

  console.log("Subscription created for user:", userId);
};

const handleSubscriptionCreated = async (subscription) => {
  console.log("Subscription created:", subscription.id);
  // This is handled in checkout.session.completed
};

const handleSubscriptionUpdated = async (subscription) => {
  console.log("=== SUBSCRIPTION UPDATE DEBUG ===");
  console.log("Subscription updated:", subscription.id);
  console.log("Billing mode:", subscription.billing_mode?.type);

  const dbSubscription = await subscriptionSchema.findOne({
    stripeSubscriptionId: subscription.id,
  });

  if (dbSubscription) {
    // Handle different billing modes for updates
    let currentPeriodStart, currentPeriodEnd;

    if (subscription.billing_mode?.type === "flexible") {
      currentPeriodStart = subscription.billing_cycle_anchor;
      const plan = subscription.plan || subscription.items.data[0].price;
      const intervalDays =
        plan.interval === "month" ? 30 : plan.interval === "year" ? 365 : 1;
      currentPeriodEnd = currentPeriodStart + intervalDays * 24 * 60 * 60;

      console.log("Using flexible billing mode for update");
    } else {
      currentPeriodStart = subscription.current_period_start;
      currentPeriodEnd = subscription.current_period_end;

      console.log("Using standard billing mode for update");
    }

    // Only update periods if we have valid data
    if (currentPeriodStart && currentPeriodEnd) {
      dbSubscription.currentPeriodStart = new Date(currentPeriodStart * 1000);
      dbSubscription.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
      console.log("Updated periods:", {
        start: new Date(currentPeriodStart * 1000),
        end: new Date(currentPeriodEnd * 1000),
      });
    } else {
      console.log("WARNING: No valid period data for update");
    }

    dbSubscription.status = subscription.status;
    dbSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    await dbSubscription.save();

    console.log("Subscription updated in database");
  } else {
    console.log("No existing subscription found for update");
  }
  console.log("=== END SUBSCRIPTION UPDATE DEBUG ===");
};

const handleSubscriptionDeleted = async (subscription) => {
  console.log("Subscription deleted:", subscription.id);

  const dbSubscription = await subscriptionSchema.findOne({
    stripeSubscriptionId: subscription.id,
  });

  if (dbSubscription) {
    dbSubscription.status = "canceled";
    await dbSubscription.save();

    console.log("Subscription canceled in database");
  }
};

const handlePaymentSucceeded = async (invoice) => {
  console.log("Payment succeeded for invoice:", invoice.id);

  const subscription = await subscriptionSchema.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "active";
    await subscription.save();
    console.log("Subscription activated after successful payment");
  }
};

const handlePaymentFailed = async (invoice) => {
  console.log("Payment failed for invoice:", invoice.id);

  const subscription = await subscriptionSchema.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "past_due";
    await subscription.save();
    console.log("Subscription marked as past due");
  }
};

module.exports = {
  handleStripeWebhook,
};
