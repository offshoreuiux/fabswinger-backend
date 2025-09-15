const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware");
const {
  addProfileToHotlist,
  deleteProfileFromHotlist,
  getProfileHotlist,
  getEventHotlist,
  addEventToHotlist,
  deleteEventFromHotlist,
  addMeetToHotlist,
  deleteMeetFromHotlist,
  getMeetHotlist,
} = require("../controllers/hotlistController");

router.use(authenticateToken);

router.get("/profile", getProfileHotlist);

router.post("/profile", addProfileToHotlist);

router.delete("/profile", deleteProfileFromHotlist);

router.get("/event", getEventHotlist);

router.post("/event", addEventToHotlist);

router.delete("/event", deleteEventFromHotlist);

router.post("/meet", addMeetToHotlist);

router.delete("/meet", deleteMeetFromHotlist);

router.get("/meet", getMeetHotlist);

module.exports = router;
