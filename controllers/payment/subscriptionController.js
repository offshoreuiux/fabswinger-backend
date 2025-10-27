const subscriptionSchema = require("../../models/payment/SubscriptionSchema");
const User = require("../../models/user/UserSchema");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { priceId } = req.body;

    console.log(
      "Creating checkout session for user:",
      userId,
      "priceId:",
      priceId
    );

    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionSchema.findOne({
      userId: userId,
      status: { $in: ["active", "trialing"] },
    });

    if (existingSubscription) {
      return res.status(400).json({
        message: "User already has an active subscription",
        isFreeLifeTime: existingSubscription.isFreeLifeTime,
      });
    }

    // Count how many free lifetime subscriptions have been claimed
    const freeSubscriptionsCount = await subscriptionSchema.countDocuments({
      isFreeLifeTime: true,
    });

    let isFreeLifeTime = false;
    if (freeSubscriptionsCount < 500) {
      isFreeLifeTime = true;
    }

    console.log(
      "Free subscriptions count:",
      freeSubscriptionsCount,
      "isFreeLifeTime:",
      isFreeLifeTime
    );

    if (isFreeLifeTime) {
      // Create free lifetime subscription
      const subscription = await subscriptionSchema.create({
        userId: user._id,
        isFreeLifeTime: true,
        status: "active",
        metadata: {
          type: "free_lifetime",
          created_at: new Date().toISOString(),
        },
      });

      return res.status(200).json({
        message: "Free lifetime subscription activated successfully!",
        success: true,
        subscription: {
          id: subscription._id,
          isFreeLifeTime: true,
          status: "active",
        },
      });
    }

    // Create paid subscription with Stripe
    try {
      // Create or retrieve Stripe customer
      let customer;
      if (user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(user.stripeCustomerId);
      } else {
        customer = await stripe.customers.create({
          email: user.email,
          name: user.nickname || user.username,
          metadata: {
            userId: user._id.toString(),
          },
        });

        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await user.save();
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.FRONTEND_URL}/#/subscriptions?success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/#/subscriptions?canceled=true`,
        metadata: {
          userId: user._id.toString(),
        },
      });

      console.log("Checkout session created successfully:", session);
      return res.status(200).json({
        message: "Checkout session created successfully",
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (stripeError) {
      console.error("Stripe error:", stripeError);
      return res.status(500).json({
        message: "Payment processing error",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("createCheckoutSession error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await subscriptionSchema.findOne({ userId });

    if (!subscription) {
      return res.status(200).json({
        hasSubscription: false,
        isFreeLifeTime: false,
        status: null,
      });
    }

    return res.status(200).json({
      hasSubscription: true,
      isFreeLifeTime: subscription.isFreeLifeTime,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error("getSubscriptionStatus error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await subscriptionSchema.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (subscription.isFreeLifeTime) {
      return res.status(400).json({
        message: "Cannot cancel free lifetime subscription",
      });
    }

    // Cancel Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      subscription.cancelAtPeriodEnd = true;
      await subscription.save();
    }

    return res.status(200).json({
      message: "Subscription will be canceled at the end of the current period",
      success: true,
    });
  } catch (error) {
    console.error("cancelSubscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await subscriptionSchema.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({ message: "No subscription found" });
    }

    if (subscription.isFreeLifeTime) {
      return res.status(400).json({
        message: "Cannot reactivate free lifetime subscription",
      });
    }

    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        message: "Subscription is not canceled",
      });
    }

    // Reactivate Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      subscription.cancelAtPeriodEnd = false;
      subscription.status = "active";
      await subscription.save();
    }

    return res.status(200).json({
      message: "Subscription has been reactivated successfully",
      success: true,
    });
  } catch (error) {
    console.error("reactivateSubscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
};
