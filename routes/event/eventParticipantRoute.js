const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  applyToEvent,
  getEventParticipants,
  updateParticipantStatus,
  leaveEvent,
  getMyParticipationStatus,
  removeParticipant,
} = require("../../controllers/event/eventParticipantController");

router.use(authenticateToken);

// Apply to join an event
router.post("/event/:eventId/apply", applyToEvent);

// Get event participants
router.get("/event/:eventId/participants", getEventParticipants);

// Get my participation status for an event
router.get("/event/:eventId/my-status", getMyParticipationStatus);

// Update participant status (for event organizers)
router.put("/participant/:participantId/status", updateParticipantStatus);

// Leave an event
router.delete("/event/:eventId/leave", leaveEvent);

// Remove participant (for event organizers)
router.delete("/participant/:participantId", removeParticipant);

module.exports = router;
