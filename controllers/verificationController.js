const User = require("../models/user/userSchema");

const startVerifyUser = async (req, res) => {
  try {
    const { userId, email } = req.params;

    if (!userId || !email) {
      return res.status(400).json({ message: "Missing userId or email" });
    }

    const user = await User.findOne({ _id: userId, email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!process.env.ONEID_CLIENT_ID) {
      return res
        .status(500)
        .json({ message: "ONEID_CLIENT_ID is not configured" });
    }

    if (!process.env.BASE_URL) {
      return res.status(500).json({ message: "BASE_URL is not configured" });
    }

    const url =
      `https://controller.sandbox.myoneid.co.uk/v2/authorize?` +
      new URLSearchParams({
        client_id: process.env.ONEID_CLIENT_ID,
        redirect_uri: "https://verifiedswingers.vercel.app/",
        response_type: "code",
        scope: "openid age_over_18",
        // state: JSON.stringify({
        //   userId,
        //   email,
        //   timestamp: Date.now(),
        // }),
        acr_values: "eidas2:LoA Substantial",
      });

    // Redirect user to OneID
    return res.status(200).json({ redirectUrl: url });
    return res.redirect(url);
  } catch (err) {
    console.error("startVerifyUser error:", err?.message || err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const callbackVerifyUser = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).json({ message: "Missing code or state" });
  }
  const stateData = JSON.parse(decodeURIComponent(state));
  const { userId, email, timestamp } = stateData;
  try {
    if (Date.now() - timestamp > 1000 * 60 * 15) {
      // 15 minutes
      return res.status(400).json({ message: "Verification link expired" });
    }
    const user = await User.findOne({ _id: userId, email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const response = await fetch(`https://connect.oneid.uk/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ONEID_CLIENT_ID,
        client_secret: process.env.ONEID_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BASE_URL}/api/verification/callback`,
      }),
    });
    if (!response.ok) {
      return res.status(400).json({ message: "Error verifying user" });
    }
    const tokenData = await response.json();
    const { access_token, id_token } = tokenData;

    if (!access_token) {
      throw new Error("No access token received from OneID");
    }

    // 3. Get user info using access token with FETCH
    const userInfoResponse = await fetch("https://connect.oneid.uk/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json();
      throw new Error(
        `User info failed: ${userInfoResponse.status} ${
          errorData.error_description || "Unknown error"
        }`
      );
    }

    const verificationData = await userInfoResponse.json();

    if (!verificationData.verified) {
      return res.status(400).json({ message: "User not verified" });
    }

    user.isVerified = true;
    await user.save();

    return res
      .status(302)
      .redirect(
        `${
          process.env.FRONTEND_URL
        }/dashboard?verified=true&name=${encodeURIComponent(
          verificationData.name || "User"
        )}&email=${encodeURIComponent(email)}`
      );
  } catch (error) {
    console.error("Error verifying user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  startVerifyUser,
  callbackVerifyUser,
};
