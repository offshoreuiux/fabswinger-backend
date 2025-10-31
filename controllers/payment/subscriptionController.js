const subscriptionSchema = require("../../models/payment/SubscriptionSchema");
const User = require("../../models/user/UserSchema");
const Affiliate = require("../../models/affiliate/AffiliateSchema");
const Referral = require("../../models/affiliate/ReferralSchema");
const Commission = require("../../models/affiliate/CommissionSchema");
const { sendMail } = require("../../utils/transporter");
const {
  generateAffiliateRegistrationEmail,
  generateAffiliateCommissionPayoutEmail,
  generateAffiliateSubscriptionCommissionEmail,
} = require("../../utils/emailTemplates");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const generateReferralCode = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const prefix = user.username
    ? user.username.slice(0, 3).toUpperCase()
    : "USR";
  const code = `${prefix}${random}`;

  // Ensure it's unique
  const exists = await Affiliate.findOne({ referralCode: code });
  return exists ? generateReferralCode(userId) : code;
};

const registerAffiliate = async (req, res) => {
  const userId = req.user.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let affiliate = await Affiliate.findOne({ userId });
  if (affiliate) {
    return res.status(200).json({
      message: "Affiliate already registered",
      success: true,
      affiliate: affiliate,
    });
  }

  const stripeAccount = await stripe.accounts.create({
    type: "express",
    email: user.email,
    capabilities: {
      card_payments: {
        requested: true,
      },
      transfers: {
        requested: true,
      },
    },
  });
  console.log("stripeAccount", stripeAccount);
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccount?.id,
    refresh_url: `${process.env.FRONTEND_URL}/#/affiliate?status=pending`,
    return_url: `${process.env.FRONTEND_URL}/#/affiliate?status=success`,
    type: "account_onboarding",
  });
  console.log("accountLink", accountLink);

  user.stripeAccountId = stripeAccount.id;
  await user.save();

  const referralCode = await generateReferralCode(userId);
  affiliate = new Affiliate({
    userId: userId,
    referralCode: referralCode,
    stripeAccountId: stripeAccount.id,
  });
  await affiliate.save();

  const emailResponse = await sendMail({
    to: user.email,
    subject: "Affiliate Registration Successful",
    html: generateAffiliateRegistrationEmail(user.username, referralCode),
  });
  console.log("emailResponse", emailResponse);

  console.log(
    `✅ Register Affiliate API successful for user: ${user.username}`
  );

  return res.status(200).json({
    message: "Affiliate registered successfully",
    success: true,
    affiliate: affiliate,
    accountLink: accountLink.url,
  });
};

const trackReferral = async (req, res) => {
  try {
    const { referralCode, referredEmail, referredUserId } = req.body;

    const affiliate = await Affiliate.findOne({ referralCode });
    if (!affiliate) {
      return res.status(404).json({ message: "Invalid referral code" });
    }

    const existingReferral = await Referral.findOne({ referredUserId });
    if (existingReferral) {
      return res.status(400).json({ message: "User already referred" });
    }

    const referral = new Referral({
      affiliateId: affiliate._id,
      referredUserId: referredUserId,
      referredEmail: referredEmail,
    });
    await referral.save();

    console.log(`✅ Track Referral API successful for user: ${referredUserId}`);

    return res
      .status(200)
      .json({ message: "Referral tracked successfully", success: true });
  } catch (error) {
    console.error("trackReferral error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionSchema.findOne({
      userId: user._id,
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
    // if (freeSubscriptionsCount < 500) {
    //   isFreeLifeTime = true;
    // }

    console.log(
      "Free subscriptions count:",
      freeSubscriptionsCount,
      "isFreeLifeTime:",
      isFreeLifeTime
    );

    if (isFreeLifeTime) {
      let affiliate = null;
      if (user.affiliateOf) {
        affiliate = await Affiliate.findOne({
          referralCode: user.affiliateOf,
        }).populate("userId", "email");
        if (!affiliate) {
          return res.status(404).json({ message: "Invalid referral code" });
        }
      }

      console.log("affiliate", affiliate);
      // Create free lifetime subscription
      const subscription = await subscriptionSchema.create({
        userId: user._id,
        isFreeLifeTime: true,
        status: "active",
        metadata: {
          type: "free_lifetime",
          created_at: new Date().toISOString(),
        },
        referredBy: affiliate ? affiliate._id : null,
      });

      if (affiliate) {
        const commission = 500; // £5.00 in minor units (pence)
        await Commission.create({
          affiliateId: affiliate._id,
          referredUserId: user._id,
          subscriptionId: subscription._id,
          amount: commission,
          status: "pending",
        });

        affiliate.totalReferrals++;
        affiliate.totalEarnings = (affiliate.totalEarnings || 0) + commission;
        affiliate.pendingPayout = (affiliate.pendingPayout || 0) + commission;
        await affiliate.save();
      }

      console.log(
        `✅ Create Checkout Session API successful (Free Lifetime) for user: ${user.username}`
      );

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
            userId: userId,
          },
        });

        // Save customer ID to user
        user.stripeCustomerId = customer.id;
        await user.save();
      }

      let affiliate = null;
      if (user.affiliateOf) {
        affiliate = await Affiliate.findOne({ referralCode: user.affiliateOf });
        if (!affiliate) {
          return res.status(400).json({ message: "Invalid referral code" });
        }
        // Check if user was already referred
        const existingReferral = await Referral.findOne({
          referredUserId: user._id,
        });
        if (!existingReferral) {
          await Referral.create({
            affiliateId: affiliate._id,
            referredUserId: user._id,
            referredEmail: user.email,
          });
        }
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
          userId: user._id,
          ...(user.affiliateOf ? { referralCode: user.affiliateOf } : {}),
        },
      });

      console.log("Checkout session created successfully:", session);
      console.log(
        `✅ Create Checkout Session API successful (Paid) for user: ${user.username}`
      );
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
      console.log(
        `✅ Get Subscription Status API successful (No subscription) for userId: ${userId}`
      );
      return res.status(200).json({
        hasSubscription: false,
        isFreeLifeTime: false,
        status: null,
      });
    }

    console.log(
      `✅ Get Subscription Status API successful for userId: ${userId}`
    );

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

    console.log(`✅ Cancel Subscription API successful for userId: ${userId}`);

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

    console.log(
      `✅ Reactivate Subscription API successful for userId: ${userId}`
    );

    return res.status(200).json({
      message: "Subscription has been reactivated successfully",
      success: true,
    });
  } catch (error) {
    console.error("reactivateSubscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const payoutAffiliate = async (req, res) => {
  try {
    const userId = req.user.userId;

    const affiliate = await Affiliate.findOne({ userId }).populate(
      "userId",
      "username email"
    );
    if (!affiliate || !affiliate.stripeAccountId) {
      return res
        .status(404)
        .json({ message: "Affiliate not found or no stripe account" });
    }

    const stripeAccount = await stripe.accounts.retrieve(
      affiliate.stripeAccountId
    );
    if (
      !stripeAccount.requirements.currently_due.length &&
      !stripeAccount.requirements.eventually_due.length
    ) {
      return res
        .status(400)
        .json({ message: "Stripe account not fully verified" });
    }

    const pendingCommissions = await Commission.find({
      affiliateId: affiliate._id,
      status: "pending",
    });

    console.log("pendingCommissions", pendingCommissions);

    const totalAmount = pendingCommissions.reduce(
      (acc, commission) => acc + commission.amount,
      0
    );
    if (totalAmount === 0) {
      return res.status(400).json({ message: "No pending commissions" });
    }

    const payout = await stripe.transfers.create({
      amount: totalAmount,
      currency: "gbp",
      destination: affiliate.stripeAccountId,
      description: `Affiliate commission payout for ${
        affiliate.userId?.username || affiliate._id
      }`,
      metadata: {
        affiliateId: affiliate._id.toString(),
      },
    });

    await Commission.updateMany(
      { affiliateId: affiliate._id, status: "pending" },
      { $set: { status: "paid" } }
    );

    affiliate.pendingPayout = 0;
    await affiliate.save();

    const affiliateUser = await User.findById(affiliate.userId);
    await sendMail({
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
      to: affiliateUser.email,
      subject: "Affiliate Commission Payout",
      html: generateAffiliateCommissionPayoutEmail(
        affiliate.userId.username,
        totalAmount
      ),
    });

    console.log(
      `✅ Payout Affiliate API successful for affiliate: ${
        affiliate.userId.username
      }, amount: £${totalAmount / 100}`
    );

    return res.status(200).json({
      message: "Payout processed",
      success: true,
      payout,
      amount: totalAmount / 100, // Convert pence to pounds for frontend
    });
  } catch (error) {
    console.error("Payout error:", error);
    return res
      .status(500)
      .json({ message: "Payout failed", error: error.message });
  }
};

const getAffiliateFunds = async (req, res) => {
  const userId = req.user.userId;
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

  try {
    const affiliate = await Affiliate.findOne({ userId }).lean();
    if (!affiliate) {
      return res.status(404).json({ message: "Not an affiliate" });
    }

    let stripeBalance = { available: 0, pending: 0 };
    if (affiliate.stripeAccountId) {
      const balance = await stripe.balance.retrieve({
        stripeAccount: affiliate.stripeAccountId,
      });
      stripeBalance = {
        available:
          (balance.available.find((b) => b.currency === "gbp")?.amount || 0) /
          100,
        pending:
          (balance.pending.find((b) => b.currency === "gbp")?.amount || 0) /
          100,
      };
    }

    const transactions = await Commission.find({ affiliateId: affiliate._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`✅ Get Affiliate Funds API successful for userId: ${userId}`);

    res.json({
      _id: affiliate._id,
      refCode: affiliate.referralCode, // Align with frontend
      totalEarnings: (affiliate.totalEarnings || 0) / 100, // Convert pence to pounds
      pendingPayout: (affiliate.pendingPayout || 0) / 100, // Convert pence to pounds
      stripeBalance,
      transactions: transactions.map((t) => ({
        _id: t._id,
        amount: t.amount / 100, // Convert pence to pounds
        status: t.status,
        date: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("getAffiliateFunds error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  registerAffiliate,
  trackReferral,
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
  payoutAffiliate,
  getAffiliateFunds,
};
