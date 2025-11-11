const User = require("../models/user/UserSchema");
const Verification = require("../models/VerificationSchema");
const Club = require("../models/club/ClubSchema");
const { s3 } = require("../utils/s3");
const { v4: uuidv4 } = require("uuid");
const { sendMail } = require("../utils/transporter");
const jwt = require("jsonwebtoken");
const {
  generateVerificationSubmittedEmail,
  generateAdminVerificationNotificationEmail,
  generateClubVerificationSubmittedEmail,
  generateAdminClubVerificationNotificationEmail,
} = require("../utils/emailTemplates");

const startAgeOver18VerifyUser = async (req, res) => {
  console.log("🚀 startAgeOver18VerifyUser - Request received");
  console.log("📋 Request params:", req.params);

  try {
    const { email } = req.params;
    console.log(`📝 Extracted email: ${email}`);

    if (!email) {
      console.log("❌ Missing email");
      return res.status(400).json({ message: "Missing email" });
    }

    console.log(
      `🔍 Searching for user with email: ${decodeURIComponent(email)}`
    );
    const user = await User.findOne({
      email: decodeURIComponent(email),
    });

    if (!user) {
      console.log(
        `❌ User not found for userId: ${user._id}, email: ${decodeURIComponent(
          email
        )}`
      );
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`✅ User found: ${user.username || user._id}`);

    if (!process.env.ONEID_CLIENT_ID) {
      console.log(
        "❌ ONEID_CLIENT_ID is not configured in environment variables"
      );
      return res
        .status(500)
        .json({ message: "ONEID_CLIENT_ID is not configured" });
    }
    console.log("✅ ONEID_CLIENT_ID is configured");

    if (!process.env.FRONTEND_URL) {
      console.log("❌ FRONTEND_URL is not configured in environment variables");
      return res
        .status(500)
        .json({ message: "FRONTEND_URL is not configured" });
    }
    console.log(`✅ FRONTEND_URL is configured: ${process.env.FRONTEND_URL}`);

    const state = `12345`;
    console.log(`🔐 Generated state: ${state}`);

    const redirectUri = `${process.env.FRONTEND_URL}/#/signup`;
    console.log(`🔗 Redirect URI: ${redirectUri}`);

    const url =
      `${process.env.ONEID_BASE_URL}/v2/authorize?` +
      new URLSearchParams({
        client_id: process.env.ONEID_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        state: state,
        scope: "openid age_over_18",
        acr_values: "eidas2:LoA Substantial",
      });

    console.log(`🌐 OneID Authorization URL generated: ${url}`);
    console.log(
      `✅ Start Age Over 18 Verify User API successful for email: ${decodeURIComponent(
        email
      )}`
    );

    // Redirect user to OneID
    return res.status(200).json({ redirectUrl: url });
  } catch (err) {
    console.error("❌ startAgeOver18VerifyUser error:", err?.message || err);
    console.error("📚 Full error stack:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const callbackAgeOver18VerifyUser = async (req, res) => {
  console.log("🚀 callbackAgeOver18VerifyUser - Callback received");
  console.log("📋 Request query params:", req.query);

  const { code, userId } = req.query;
  console.log(
    `📝 Extracted authorization code: ${
      code ? code.substring(0, 20) + "..." : "N/A"
    }`
  );

  if (!code) {
    console.log("❌ Missing authorization code");

    // Delete user if verification fails and oneIdAgeOver18Verified is false
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user && !user.oneIdAgeOver18Verified) {
          await user.deleteOne();
          console.log("🗑️ User deleted due to missing authorization code");
        }
      } catch (deleteError) {
        console.error("❌ Error deleting user:", deleteError);
      }
    }

    return res.status(400).json({ message: "Missing code or state" });
  }

  try {
    // Validate required environment variables
    if (!process.env.ONEID_CLIENT_ID || !process.env.ONEID_CLIENT_SECRET) {
      console.error("❌ Missing OneID credentials in environment variables");

      // Delete user if verification fails and oneIdAgeOver18Verified is false
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user && !user.oneIdAgeOver18Verified) {
            await user.deleteOne();
            console.log("🗑️ User deleted due to missing OneID credentials");
          }
        } catch (deleteError) {
          console.error("❌ Error deleting user:", deleteError);
        }
      }

      return res.status(500).json({
        message: "OneID credentials not configured",
      });
    }

    if (!process.env.ONEID_BASE_URL) {
      console.error("❌ Missing ONEID_BASE_URL in environment variables");

      // Delete user if verification fails and oneIdAgeOver18Verified is false
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user && !user.oneIdAgeOver18Verified) {
            await user.deleteOne();
            console.log("🗑️ User deleted due to missing OneID base URL");
          }
        } catch (deleteError) {
          console.error("❌ Error deleting user:", deleteError);
        }
      }

      return res.status(500).json({
        message: "OneID base URL not configured",
      });
    }

    const tokenEndpoint = `${process.env.ONEID_BASE_URL}/token`;
    const redirectUri = `${process.env.FRONTEND_URL}/#/signup`;

    console.log(`🔗 Token endpoint: ${tokenEndpoint}`);
    console.log(`🔗 Redirect URI: ${redirectUri}`);
    console.log(`📤 Requesting access token from OneID...`);

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.ONEID_CLIENT_ID}:${process.env.ONEID_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        // client_id: process.env.ONEID_CLIENT_ID,
        // client_secret: process.env.ONEID_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    console.log(
      `📥 Token response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Token request failed");
      console.error(`📄 Response body: ${errorText}`);

      // Try to parse the error response for more details
      let errorMessage = "Error verifying user";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.error_description || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }

      // Delete user if verification fails and oneIdAgeOver18Verified is false
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user && !user.oneIdAgeOver18Verified) {
            await user.deleteOne();
            console.log("🗑️ User deleted due to token request failure");
          }
        } catch (deleteError) {
          console.error("❌ Error deleting user:", deleteError);
        }
      }

      return res.status(400).json({
        message: errorMessage,
        details: errorText,
      });
    }

    const tokenData = await response.json();
    console.log("✅ Token data received successfully");
    console.log("📋 Token data keys:", Object.keys(tokenData));

    const { access_token, id_token } = tokenData;

    if (!access_token) {
      console.error("❌ No access token received from OneID");
      throw new Error("No access token received from OneID");
    }
    console.log(
      `✅ Access token received: ${access_token.substring(0, 20)}...`
    );
    if (id_token) {
      console.log(`✅ ID token received: ${id_token.substring(0, 20)}...`);
    }

    // 3. Get user info using access token with FETCH
    const userInfoEndpoint = `${process.env.ONEID_BASE_URL}/userinfo`;
    console.log(`🔗 UserInfo endpoint: ${userInfoEndpoint}`);
    console.log(`📤 Requesting user info from OneID...`);

    const userInfoResponse = await fetch(userInfoEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    console.log(
      `📥 UserInfo response status: ${userInfoResponse.status} ${userInfoResponse.statusText}`
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json();
      console.error("❌ UserInfo request failed");
      console.error("📄 Error data:", errorData);
      throw new Error(
        `User info failed: ${userInfoResponse.status} ${
          errorData.error_description || "Unknown error"
        }`
      );
    }

    const verificationData = await userInfoResponse.json();
    console.log("✅ Verification data received successfully");
    console.log(
      "📋 Verification data:",
      JSON.stringify(verificationData, null, 2)
    );

    // if (!verificationData.verified) {
    //   console.log("❌ User not verified according to verification data");
    //   return res.status(400).json({ message: "User not verified" });
    // }

    console.log(`✅ Callback Age Over 18 Verify User API successful`);

    let user = await User.findById(userId);

    if (!verificationData.age_over_18) {
      if (user) {
        await user.deleteOne();
        console.log("🗑️ User deleted - not age over 18");
      }
      return res.status(403).json({
        message: "User is not age verified",
        success: false,
      });
    }

    if (user) {
      user.oneIdAgeOver18Verified = true;
      await user.save();
    }

    if (!user) {
      console.warn("⚠️ Verified user record not found during callback");
      return res.status(404).json({
        message: "Verified user not found",
        success: false,
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET not configured");
      return res.status(500).json({
        message: "Authentication configuration missing",
        success: false,
      });
    }
    console.log("user", user);
    const tokenExpiration = user.keepSignedIn ? "30d" : "7d";
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiration }
    );

    return res.status(200).json({
      message: "User age over 18 verified successfully",
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
      },
      verificationData,
    });
  } catch (error) {
    console.error("❌ Error verifying user:", error?.message || error);
    console.error("📚 Full error stack:", error);

    // Delete user if verification fails and oneIdAgeOver18Verified is false
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user && !user.oneIdAgeOver18Verified) {
          await user.deleteOne();
          console.log("🗑️ User deleted due to verification error");
        }
      } catch (deleteError) {
        console.error("❌ Error deleting user:", deleteError);
      }
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

const userImageVerification = async (req, res) => {
  try {
    const { userId = "", email = "" } = req.body;
    console.log("start userImageVerification");

    console.log("userId", userId, email);

    let user;
    if (userId) {
      console.log("userId found");
      user = await User.findById(userId);
    } else {
      console.log("email found");
      user = await User.findOne({ email });
    }

    if (!user) {
      console.log("username found");
      user = await User.findOne({ username: email });
    }

    if (!user) {
      console.log("user not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("user found", user);

    if (!req.file) {
      console.log("file not found");
      return res
        .status(400)
        .json({ message: "Verification image is required" });
    }
    const file = req.file;

    // Check for existing pending verification
    const existingVerification = await Verification.findOne({
      userId: user?._id,
      type: "user",
      status: "pending",
    });

    if (existingVerification) {
      return res
        .status(400)
        .json({ message: "Already has a pending verification" });
    }

    // Verify the entity exists

    let uploadResult = null;
    if (file) {
      const fileName = `verification-images/${uuidv4()}-${file.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      uploadResult = await s3.upload(params).promise();
    }

    const verificationData = {
      status: "pending",
      type: "user",
    };

    if (uploadResult) {
      verificationData.verificationImage = uploadResult.Location;
    }

    verificationData.userId = user?._id;
    console.log("verificationData", verificationData);

    const newVerification = new Verification(verificationData);
    await newVerification.save();

    // Send email notification
    const mailEmail = user.email;
    const name = user.username;

    // Use appropriate email templates based on verification type
    const userMailOptions = {
      to: mailEmail,
      subject: "New Verification Submitted",
      html: generateVerificationSubmittedEmail(name),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };

    const adminMailOptions = {
      to: process.env.ADMIN_EMAIL,
      subject: "New Verification Submitted",
      html: generateAdminVerificationNotificationEmail(name, user?._id),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };
    await sendMail(userMailOptions);
    await sendMail(adminMailOptions);

    console.log(
      `✅ User Image Verification API successful for userId: ${user._id}`
    );

    return res
      .status(200)
      .json({ message: "Verification submitted successfully", success: true });
  } catch (error) {
    console.error("Error verifying user image:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const clubVerification = async (req, res) => {
  try {
    const {
      clubId,
      type = "club",
      clubName,
      clubEmail,
      clubPhone,
      clubWebsite,
      businessLicense,
    } = req.body;
    if (
      !clubName ||
      !clubEmail ||
      !clubPhone ||
      !clubWebsite ||
      !businessLicense
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    console.log("type", type);
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }
    if (club.isVerified === true) {
      return res.status(400).json({ message: "Club is already verified" });
    }
    const verificationData = {
      clubId,
      type,
      clubName,
      clubEmail,
      clubPhone,
      clubWebsite,
      businessLicense,
      status: "pending",
    };
    const newVerification = new Verification(verificationData);
    await newVerification.save();

    club.verificationStatus = "applied";
    await club.save();

    // Send email notifications
    const userMailOptions = {
      to: clubEmail,
      subject: "New Club Verification Submitted",
      html: generateClubVerificationSubmittedEmail(clubName),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };

    const adminMailOptions = {
      to: process.env.ADMIN_EMAIL,
      subject: "New Club Verification Submitted",
      html: generateAdminClubVerificationNotificationEmail(clubName, clubId),
      from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    };

    await sendMail(userMailOptions);
    await sendMail(adminMailOptions);

    console.log(`✅ Club Verification API successful for clubId: ${clubId}`);

    return res
      .status(200)
      .json({ message: "Verification submitted successfully", success: true });
  } catch (error) {
    console.error("Error verifying club:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  startAgeOver18VerifyUser,
  callbackAgeOver18VerifyUser,
  userImageVerification,
  clubVerification,
};
