const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware");
const {
  applyToMeet,
  getMeetParticipants,
  updateParticipantStatus,
  leaveMeet,
  getMyParticipationStatus,
  removeParticipant,
} = require("../../controllers/meet/meetParticipantController");

router.use(authenticateToken);

// Apply to join an meet
router.post("/meet/:meetId/apply", applyToMeet);

// Get meet participants
router.get("/meet/:meetId/participants", getMeetParticipants);

// Get my participation status for an meet
router.get("/meet/:meetId/my-status", getMyParticipationStatus);

// Update participant status (for meet organizers)
router.put("/participant/:participantId/status", updateParticipantStatus);

// Leave an meet
router.delete("/meet/:meetId/leave", leaveMeet);

// Remove participant (for meet organizers)
router.delete("/participant/:participantId", removeParticipant);

module.exports = router;
