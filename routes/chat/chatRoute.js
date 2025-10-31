const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  createChat,
  getChats,
  markAsRead,
  clearChat,
  leaveGroup,
  updateGroup,
  deleteGroup,
} = require("../../controllers/chat/chatController");

router.use(authenticateToken);

router.post("/create", createChat);

router.get("/get", getChats);

router.post("/markAsRead/:chatId", markAsRead);

router.post("/clear/:chatId", clearChat);

router.post("/leave/:chatId", leaveGroup);

router.post("/update/:chatId", updateGroup);

router.delete("/delete/:chatId", deleteGroup);

module.exports = router;
