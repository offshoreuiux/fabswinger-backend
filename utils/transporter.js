const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
// const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
dotenv.config();

// SendGrid implementation
// const sgMail = require("@sendgrid/mail");
// if (process.env.SENDGRID_API_KEY) {
//   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// } else {
//   console.log("⚠️  SENDGRID_API_KEY is not set. Emails will not be sent.");
// }

// const defaultFrom = process.env.SENDGRID_FROM_EMAIL;

// function sendMail(mailOptions, callback) {
//   const msg = {
//     to: mailOptions.to,
//     from: mailOptions.from || defaultFrom,
//     subject: mailOptions.subject,
//     html: mailOptions.html,
//     text: mailOptions.text,
//     replyTo: mailOptions.replyTo || process.env.SENDGRID_REPLY_TO,
//   };

//   const promise = sgMail
//     .send(msg)
//     .then((res) => ({ response: res && res[0] && res[0].statusCode }))
//     .catch((err) => {
//       console.log("Email error:", err?.message || err);
//       throw err;
//     });

//   if (typeof callback === "function") {
//     promise.then((info) => callback(null, info)).catch((err) => callback(err));
//     return;
//   }
//   return promise;
// }

// module.exports = { sendMail };

//  AWS SES implementation

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  SES: {
    sesClient,
    SendEmailCommand,
  },
});

const sendMail = async (mailOptions) => {
  try {
    const { to, subject, html, text } = mailOptions;
    // if (!to || !subject || !html || !text) {
    //   throw new Error("Missing required fields");
    // }
    const mailData = {
      from: process.env.AWS_SES_FROM_EMAIL,
      to,
      subject,
      html,
      text,
    };
    const result = await transporter.sendMail(mailData);
    console.log("Email sent successfully", result);
    return result;
  } catch (error) {
    console.error("Error sending email", error);
    throw error;
  }
};

module.exports = { sendMail };
