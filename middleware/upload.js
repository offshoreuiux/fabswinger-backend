const multer = require("multer");

// In-memory storage
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;
