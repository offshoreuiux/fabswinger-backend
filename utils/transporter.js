const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with multiple fallback options
let transporter;

const createTransporter = () => {
  // Try different email configurations in order of preference
  const configs = [
    // 1. Gmail with App Password (most reliable for production)
    {
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
    },
    // 2. Custom SMTP with Gmail
    {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    },
    // 3. Mailtrap (for testing)
    {
      host: process.env.MAILTRAP_HOST,
      port: process.env.MAILTRAP_PORT,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    },
    // 4. Generic SMTP
    {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    },
  ];

  // Find the first configuration that has all required environment variables
  for (const config of configs) {
    if (config.service === "gmail") {
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        console.log("Using Gmail service configuration");
        return nodemailer.createTransport(config);
      }
    } else if (config.host === "smtp.gmail.com") {
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        console.log("Using Gmail SMTP configuration");
        return nodemailer.createTransport(config);
      }
    } else if (config.host === process.env.MAILTRAP_HOST) {
      if (
        process.env.MAILTRAP_HOST &&
        process.env.MAILTRAP_USER &&
        process.env.MAILTRAP_PASS
      ) {
        console.log("Using Mailtrap configuration");
        return nodemailer.createTransport(config);
      }
    } else {
      if (
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
      ) {
        console.log("Using custom SMTP configuration");
        return nodemailer.createTransport(config);
      }
    }
  }

  // Fallback: Use console logging instead of email
  console.log(
    "No valid email configuration found. Email functionality disabled."
  );
  return null;
};

transporter = createTransporter();

// Verify transporter configuration
if (transporter) {
  transporter.verify(function (error, success) {
    if (error) {
      console.log("Email transporter error:", error);
      console.log("Email functionality may not work properly");
    } else {
      console.log("Email server is ready to send messages");
    }
  });
} else {
  console.log("No email transporter configured");
}

module.exports = transporter;
