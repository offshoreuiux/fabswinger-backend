const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  // sendMessage, // Commented out since we're using sockets now
  getMessages,
  updateMessageStatus,
} = require("../../controllers/chat/messageController");

router.use(authenticateToken);

// router.post("/send", sendMessage); // Commented out since we're using sockets now

router.get("/get/:chatId", getMessages);

router.put("/update", updateMessageStatus);

module.exports = router;
