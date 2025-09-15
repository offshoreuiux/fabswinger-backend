const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  createMeet,
  getMeets,
  updateMeet,
  getMeetById,
  getUserMeets,
} = require("../../controllers/meet/meetController");

router.use(authenticateToken);

router.post("/", createMeet);

router.put("/:id", updateMeet);

router.get("/", getMeets);

router.get("/user/meets", getUserMeets);

router.get("/:id", getMeetById);

module.exports = router;
