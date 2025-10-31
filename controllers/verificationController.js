const User = require("../models/user/UserSchema");
const Verification = require("../models/VerificationSchema");
const Club = require("../models/club/ClubSchema");
const { s3 } = require("../utils/s3");
const { v4: uuidv4 } = require("uuid");
const { sendMail } = require("../utils/transporter");
const {
  generateVerificationSubmittedEmail,
  generateAdminVerificationNotificationEmail,
  generateClubVerificationSubmittedEmail,
  generateAdminClubVerificationNotificationEmail,
} = require("../utils/emailTemplates");

const startAgeOver18VerifyUser = async (req, res) => {
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

    if (!process.env.FRONTEND_URL) {
      return res
        .status(500)
        .json({ message: "FRONTEND_URL is not configured" });
    }

    const state = `12345`;

    const url =
      `${process.env.ONEID_BASE_URL}/v2/authorize?` +
      new URLSearchParams({
        client_id: process.env.ONEID_CLIENT_ID,
        redirect_uri: `${process.env.FRONTEND_URL}/#/oneid-loading`,
        response_type: "code",
        state: state,
        scope: "openid age_over_18",
        acr_values: "eidas2:LoA Substantial",
      });

    console.log(
      `✅ Start Age Over 18 Verify User API successful for userId: ${userId}`
    );
    // Redirect user to OneID
    return res.status(200).json({ redirectUrl: url });
  } catch (err) {
    console.error("startVerifyUser error:", err?.message || err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const callbackAgeOver18VerifyUser = async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ message: "Missing code or state" });
  }
  try {
    const response = await fetch(`${process.env.ONEID_BASE_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.ONEID_CLIENT_ID}:${process.env.ONEID_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ONEID_CLIENT_ID,
        client_secret: process.env.ONEID_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.FRONTEND_URL}/#/oneid-loading`,
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
    const userInfoResponse = await fetch(
      `${process.env.ONEID_BASE_URL}/userinfo`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      }
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json();
      throw new Error(
        `User info failed: ${userInfoResponse.status} ${
          errorData.error_description || "Unknown error"
        }`
      );
    }

    const verificationData = await userInfoResponse.json();

    // if (!verificationData.verified) {
    //   return res.status(400).json({ message: "User not verified" });
    // }

    console.log(`✅ Callback Age Over 18 Verify User API successful`);

    return res.status(200).json({
      message: "User age over 18 verified successfully",
      verificationData,
      success: true,
    });
  } catch (error) {
    console.error("Error verifying user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const userImageVerification = async (req, res) => {
  try {
    const { userId = "", email = "" } = req.body;

    console.log("userId", userId, email);

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email });
    }

    if (!user) {
      user = await User.findOne({ username: email });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!req.file) {
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

    club.isVerified = "pending";
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
