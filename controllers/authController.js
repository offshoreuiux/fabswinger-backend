const User = require("../models/user/UserSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  generatePasswordResetEmail,
  generateAffiliateNewSignupEmail,
  generateReferredUserWelcomeEmail,
} = require("../utils/emailTemplates");
const { sendMail } = require("../utils/transporter");
const Verification = require("../models/VerificationSchema");
const Subscription = require("../models/payment/SubscriptionSchema");
const Affiliate = require("../models/affiliate/AffiliateSchema");

// Import fetch - use global fetch for Node.js 18+ or node-fetch for older versions
const fetch = globalThis.fetch || require("node-fetch");

// reCAPTCHA verification function
const verifyRecaptcha = async (recaptchaToken) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.log("RECAPTCHA_SECRET_KEY not found, skipping verification");
    return true; // Skip verification in development
  }

  if (!recaptchaToken) {
    console.log("No reCAPTCHA token provided");
    return false;
  }

  // Check if fetch is available
  if (typeof fetch !== "function") {
    console.error("Fetch is not available");
    return false;
  }
  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${secretKey}&response=${recaptchaToken}`,
      }
    );
    console.log("response", response);

    if (!response.ok) {
      console.error(
        "reCAPTCHA API response not ok:",
        response.status,
        response.statusText
      );
      return false;
    }

    const data = await response.json();
    console.log("reCAPTCHA response:", data);

    if (data.success) {
      console.log("reCAPTCHA verification successful");
      return true;
    } else {
      console.log("reCAPTCHA verification failed:", data["error-codes"]);
      return false;
    }
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
};

const signup = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      keepSignedIn,
      geoLocation,
      recaptchaToken,
      affiliateCode,
    } = req.body;

    console.log("affiliateCode", affiliateCode);

    // Verify reCAPTCHA token
    if (recaptchaToken) {
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return res.status(400).json({
          error: "reCAPTCHA verification failed. Please try again.",
        });
      }
    } else {
      return res.status(400).json({
        error: "reCAPTCHA verification is required.",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      keepSignedIn: keepSignedIn || false,
      geoLocation,
      affiliateOf: affiliateCode,
    });
    await newUser.save();

    // console.log("newUser", newUser);

    // Handle affiliate emails if user signed up with referral code
    if (affiliateCode) {
      try {
        const affiliate = await Affiliate.findOne({
          referralCode: affiliateCode,
        }).populate("userId", "username email");

        if (affiliate && affiliate.userId) {
          // Send email to affiliate about new signup
          await sendMail({
            to: affiliate.userId.email,
            from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
            subject: "New User Signed Up Using Your Referral Code!",
            html: generateAffiliateNewSignupEmail(
              affiliate.userId.username,
              newUser.username,
              affiliateCode
            ),
          });

          // Send welcome email to new user mentioning who referred them
          await sendMail({
            to: newUser.email,
            from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
            subject: "Welcome to VerifiedSwingers!",
            html: generateReferredUserWelcomeEmail(
              newUser.username,
              affiliate.userId.username
            ),
          });

          console.log(
            `Affiliate emails sent for referral: ${affiliateCode} by ${affiliate.userId.username}`
          );
        }
      } catch (emailError) {
        // Don't fail signup if emails fail
        console.error("Error sending affiliate emails:", emailError);
      }
    }

    // Generate token with different expiration based on keepSignedIn preference
    const tokenExpiration = keepSignedIn ? "30d" : "7d";
    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      {
        expiresIn: tokenExpiration,
      }
    );

    console.log(`✅ Signup API successful for user: ${newUser.username}`);

    res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      keepSignedIn: newUser.keepSignedIn,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error during signup",
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password, keepSignedIn, geoLocation, recaptchaToken } =
      req.body;

    // Verify reCAPTCHA token if provided (optional for login)
    if (recaptchaToken) {
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return res.status(400).json({
          error: "reCAPTCHA verification failed. Please try again.",
        });
      }
    }

    // Check if username or email is provided
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Try to find user by email first, then by username
    let user = await User.findOne({ email: username }).select("+password");
    if (!user) {
      // If not found by email, try username
      user = await User.findOne({ username: username }).select("+password");
    }

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid username/email or password" });
    }

    if (!user.isVerified && user.role != "admin") {
      const hasAppliedForVerification = await Verification.findOne({
        userId: user._id,
        type: "user",
        status: "pending",
      });
      if (hasAppliedForVerification) {
        return res.status(400).json({
          error:
            "You have already applied for verification, please wait for approval",
        });
      } else {
        const verification = await Verification.findOne({
          userId: user._id,
          type: "user",
          status: "rejected",
        });
        if (verification) {
          return res.status(400).json({
            error:
              "Your verification request has been rejected, please apply for verification again",
          });
        } else {
          return res.status(400).json({
            error:
              "You have not applied for verification yet, please apply for verification now",
          });
        }
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Invalid username/email or password" });
    }

    // Block login for deactivated users
    if (user.isActive === false) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // Use user's keepSignedIn preference if not explicitly provided in login
    const shouldKeepSignedIn =
      keepSignedIn !== undefined ? keepSignedIn : user.keepSignedIn;

    // Generate token with different expiration based on keepSignedIn preference
    const tokenExpiration = shouldKeepSignedIn ? "30d" : "7d";
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: tokenExpiration,
      }
    );
    // Only save geoLocation if it is a valid GeoJSON Point
    if (
      geoLocation &&
      geoLocation.type === "Point" &&
      Array.isArray(geoLocation.coordinates) &&
      geoLocation.coordinates.length === 2 &&
      Number.isFinite(geoLocation.coordinates[0]) &&
      Number.isFinite(geoLocation.coordinates[1])
    ) {
      user.geoLocation = geoLocation;
    }
    await user.save();

    console.log(`✅ Login API successful for user: ${user.username}`);

    res.json({
      token,
      keepSignedIn: shouldKeepSignedIn,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
};

const verifyToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    // The middleware has already verified the token and added user info to req.user
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Force logout if user got deactivated after token issuance
    if (user.isActive === false) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    if (!user.isVerified && user.role != "admin") {
      return res.status(400).json({
        error: "You are not verified yet, please wait for verification",
      });
    }

    const subscription = await Subscription.findOne({ userId });

    console.log(`✅ Verify Token API successful for user: ${user.username}`);

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        keepSignedIn: user.keepSignedIn,
        profileImage: user.profileImage,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during token verification" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    // ./mail.js

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }
    const code = Math.floor(100000 + Math.random() * 900000);

    const mailOptions = {
      to: email,
      subject: "Password Reset Code - VerifiedSwingers",
      html: generatePasswordResetEmail(code),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };

    try {
      await sendMail(mailOptions);
      // Only save the code if email was sent successfully
      user.passwordResetCode = code;
      user.passwordResetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();
      console.log(`✅ Forgot Password API successful for email: ${email}`);
      res.json({ success: true, message: "Password reset code sent to email" });
    } catch (err) {
      console.log("Email error:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Failed to send password reset email",
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error during forgot password" });
  }
};

const verifyPasswordResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found", success: false });
    }
    // Check code matches and not expired
    if (
      user.passwordResetCode != code ||
      !user.passwordResetCodeExpires ||
      user.passwordResetCodeExpires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid code", success: false });
    }
    console.log(
      `✅ Verify Password Reset Code API successful for email: ${email}`
    );
    res.json({
      message:
        "Code verified successfully, navigating to create new password page",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error during verify password reset code",
      success: false,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ error: "User not found", success: false });
    }
    // Prevent reusing the same password
    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      return res.status(400).json({
        error: "New password cannot be the same as the old password",
        success: false,
      });
    }
    if (
      user.passwordResetCode != code ||
      !user.passwordResetCodeExpires ||
      user.passwordResetCodeExpires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid code", success: false });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetCode = null;
    user.passwordResetCodeExpires = null;
    await user.save();
    console.log(`✅ Reset Password API successful for email: ${email}`);
    res.json({
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error during reset password",
      success: false,
    });
  }
};

module.exports = {
  signup,
  login,
  verifyToken,
  forgotPassword,
  verifyPasswordResetCode,
  resetPassword,
};
