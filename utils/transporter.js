const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  //   host:process.env.SMTP_HOST,
  //   port: process.env.SMTP_PORT,
  //   secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
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

module.exports = transporter;
