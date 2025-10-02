const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { google } = require("googleapis");
dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Create reusable transporter object using SMTP transport
let transporter;

const initializeTransporter = async () => {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    // Verify transporter configuration
    transporter.verify(function (error, success) {
      if (error) {
        console.log("Email transporter error:", error);
      } else {
        console.log("Email server is ready to send messages");
      }
    });
  } catch (error) {
    console.error("Failed to initialize OAuth2 transporter:", error);
    // Fallback to basic SMTP configuration
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
};

// Initialize transporter
initializeTransporter();

module.exports = {
  getTransporter: () => transporter,
  initializeTransporter,
};
