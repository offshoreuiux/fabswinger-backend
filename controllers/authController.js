const User = require("../models/UserSchema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const signup = async (req, res) => {
  try {
    const { username, email, password, keepSignedIn, geoLocation } = req.body;

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
    // const tokenExpiration = keepSignedIn ? "30d" : "7d";
    // const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
    //   expiresIn: tokenExpiration,
    // });

    res.status(201).json({
      success: true,
      message: "Signup successful",
      // token,       
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
    const { username, password, keepSignedIn, geoLocation } = req.body;

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
    user.geoLocation = geoLocation;
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

module.exports = { signup, login, verifyToken };
