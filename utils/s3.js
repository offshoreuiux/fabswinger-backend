const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // from your AWS IAM
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getS3KeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return decodeURIComponent(urlObj.pathname.substring(1));
    // removes leading "/" and decodes %20 -> spaces
  } catch (error) {
    console.error("Invalid S3 URL:", error);
    return null;
  }
};

module.exports = { s3, getS3KeyFromUrl };
