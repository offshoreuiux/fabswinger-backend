require("dotenv").config();
const mail = require("../services/mailService");

async function main() {
  const to = process.env.TEST_EMAIL_TO;
  if (!to) {
    console.error("Set TEST_EMAIL_TO in your .env to run this test");
    process.exit(1);
  }
  const res = await mail.send({
    to,
    subject: "Test email from VerifiedSwingers",
    html: "<p>This is a test email.</p>",
  });
  console.log("Sent:", res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
