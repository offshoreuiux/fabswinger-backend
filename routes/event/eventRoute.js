const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  createEvent,
  getEvents,
  updateEvent,
  getEventById,
  updateEventRules,
} = require("../../controllers/event/eventController");
const upload = require("../../middleware/upload");

router.use(authenticateToken);

router.post("/", upload.single("image"), createEvent);

router.put("/:id", upload.single("image"), updateEvent);

router.patch("/:id/rules", updateEventRules);

router.get("/", getEvents);

router.get("/:id", getEventById);

module.exports = router;
