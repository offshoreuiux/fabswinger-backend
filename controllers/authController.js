const User = require("../models/UserSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { generatePasswordResetEmail } = require("../utils/emailTemplates");
const transporter = require("../utils/transporter");
const nodemailer = require("nodemailer");

// Import fetch - use global fetch for Node.js 18+ or node-fetch for older versions
const fetch = globalThis.fetch || require("node-fetch");

// reCAPTCHA verification function
const verifyRecaptcha = async (recaptchaToken) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  console.log("secretKey", secretKey, recaptchaToken);

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
    } = req.body;

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
    });
    await newUser.save();

    console.log("newUser", newUser);

    // Generate token with different expiration based on keepSignedIn preference
    const tokenExpiration = keepSignedIn ? "30d" : "7d";
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: tokenExpiration,
    });

    res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      keepSignedIn: newUser.keepSignedIn,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
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

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Invalid username/email or password" });
    }

    // Use user's keepSignedIn preference if not explicitly provided in login
    const shouldKeepSignedIn =
      keepSignedIn !== undefined ? keepSignedIn : user.keepSignedIn;

    // Generate token with different expiration based on keepSignedIn preference
    const tokenExpiration = shouldKeepSignedIn ? "30d" : "7d";
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: tokenExpiration,
    });
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

    res.json({
      token,
      keepSignedIn: shouldKeepSignedIn,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
};

const verifyToken = async (req, res) => {
  try {
    // The middleware has already verified the token and added user info to req.user
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        keepSignedIn: user.keepSignedIn,
        profileImage: user.profileImage,
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
    user.passwordResetCode = code;
    await user.save();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Password Reset Code - VerifiedSwingers",
      html: generatePasswordResetEmail(code),
    };

    if (transporter) {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Email error:", error);
        } else {
          console.log("Email sent: ", info.response);
        }
      });
    } else {
      console.log(
        "Email transporter not available. Password reset code:",
        code
      );
      console.log(
        "Please set up email configuration in environment variables."
      );
    }

    res.json({ code });
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
    if (user.passwordResetCode != code) {
      return res.status(400).json({ error: "Invalid code", success: false });
    }
    res.json({ message: "Code verified", success: true });
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
    if (user.passwordResetCode != code) {
      return res.status(400).json({ error: "Invalid code", success: false });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetCode = null;
    await user.save();
    res.json({ message: "Password reset successfully", success: true });
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
