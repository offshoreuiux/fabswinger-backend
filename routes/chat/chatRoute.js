const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  createChat,
  getChats,
  markAsRead,
} = require("../../controllers/chat/chatController");

router.use(authenticateToken);

router.post("/create", createChat);

router.get("/get", getChats);

router.post("/markAsRead/:chatId", markAsRead);

module.exports = router;
