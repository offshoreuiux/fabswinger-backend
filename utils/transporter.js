const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create transporter with multiple fallback options
let transporter;
let isVerifying = false;

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
      connectionTimeout: 30000, // 30 seconds - reduced for Render.com
      greetingTimeout: 15000, // 15 seconds
      socketTimeout: 30000, // 30 seconds
      pool: true, // Enable connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 20000, // 20 seconds
      rateLimit: 5, // 5 emails per rateDelta
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
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 20000,
      rateLimit: 5,
    },
    // 3. Mailtrap (for testing)
    {
      host: process.env.MAILTRAP_HOST,
      port: process.env.MAILTRAP_PORT,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
      connectionTimeout: 20000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
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
      connectionTimeout: 20000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
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

// Enhanced verification with retry mechanism
const verifyTransporterWithRetry = async (retries = 3, delay = 5000) => {
  if (!transporter || isVerifying) {
    return;
  }

  isVerifying = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `Verifying email transporter (attempt ${attempt}/${retries})...`
      );

      const success = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Verification timeout"));
        }, 15000); // 15 second timeout for verification

        transporter.verify((error, success) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(success);
          }
        });
      });

      if (success) {
        console.log("✅ Email server is ready to send messages");
        isVerifying = false;
        return;
      }
    } catch (error) {
      console.log(
        `❌ Email transporter verification failed (attempt ${attempt}/${retries}):`,
        error.message
      );

      if (attempt === retries) {
        console.log("⚠️  Email functionality may not work properly");
        console.log(
          "💡 Consider checking your email configuration and environment variables"
        );
        console.log(
          "🔧 For Render.com deployment, ensure SMTP ports are not blocked"
        );
      } else {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }

  isVerifying = false;
};

// Start verification asynchronously to avoid blocking app startup
if (transporter) {
  verifyTransporterWithRetry().catch(console.error);
} else {
  console.log("No email transporter configured");
}

// Enhanced email sending function with retry and fallback
const sendEmailWithRetry = async (mailOptions, retries = 2) => {
  if (!transporter) {
    console.log("❌ No email transporter available");
    return { success: false, error: "No email transporter configured" };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📧 Sending email (attempt ${attempt}/${retries})...`);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Email send timeout"));
        }, 30000); // 30 second timeout for sending

        transporter.sendMail(mailOptions, (error, info) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(info);
          }
        });
      });

      console.log("✅ Email sent successfully:", result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.log(
        `❌ Email send failed (attempt ${attempt}/${retries}):`,
        error.message
      );

      if (attempt === retries) {
        console.log("⚠️  All email send attempts failed");
        return { success: false, error: error.message };
      } else {
        // Wait before retry with exponential backoff
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying email send in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
};

// Export both the transporter and the enhanced send function
module.exports = {
  transporter,
  sendEmailWithRetry,
};
