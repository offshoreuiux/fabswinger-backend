const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
// const { google } = require("googleapis");
dotenv.config();

// let transporter = null;

// const hasGmailOauth =
//   process.env.EMAIL_USER &&
//   process.env.GOOGLE_CLIENT_ID &&
//   process.env.GOOGLE_CLIENT_SECRET &&
//   process.env.GOOGLE_REFRESH_TOKEN;

// if (hasGmailOauth) {
//   // Create transporter using Gmail OAuth2. accessToken is optional; Nodemailer will fetch it using refreshToken.
//   transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       type: "OAuth2",
//       user: process.env.EMAIL_USER,
//       clientId: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
//     },
//     connectionTimeout: 20000,
//     greetingTimeout: 10000,
//     socketTimeout: 20000,
//     pool: true,
//     maxConnections: 3,
//     maxMessages: 50,
//   });
// } else {
//   console.log(
//     "⚠️  Gmail OAuth2 env vars missing; email transporter not configured"
//   );
// }

// Existing Nodemailer/SMTP (kept commented by request)
// const transporter = nodemailer.createTransport({
//   // service: "gmail",
//   host: "smtp.gmail.com",
//   // host: process.env.SMTP_HOST,
//   // port: process.env.SMTP_PORT,
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// SendGrid implementation
const sgMail = require("@sendgrid/mail");
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.log("⚠️  SENDGRID_API_KEY is not set. Emails will not be sent.");
}

const defaultFrom = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER;

function sendMail(mailOptions, callback) {
  const msg = {
    to: mailOptions.to,
    from: mailOptions.from || defaultFrom,
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text,
    replyTo: mailOptions.replyTo || process.env.SENDGRID_REPLY_TO,
  };

  const promise = sgMail
    .send(msg)
    .then((res) => ({ response: res && res[0] && res[0].statusCode }))
    .catch((err) => {
      console.log("Email error:", err?.message || err);
      throw err;
    });

  if (typeof callback === "function") {
    promise.then((info) => callback(null, info)).catch((err) => callback(err));
    return;
  }
  return promise;
}

// const transporter = nodemailer.createTransport({
//   host: process.env.MAILTRAP_HOST,
//   port: process.env.MAILTRAP_PORT,
//   auth: {
//     user: process.env.MAILTRAP_USER,
//     pass: process.env.MAILTRAP_PASS,
//   },
// });

// Verify transporter configuration (skip in production to avoid cloud SMTP timeouts)
// if (transporter && process.env.NODE_ENV !== "production") {
//   transporter.verify(function (error, success) {
//     if (error) {
//       console.log("Email transporter error:", error);
//     } else {
//       console.log("Email server is ready to send messages");
//     }
//   });
// }

module.exports = { sendMail };
