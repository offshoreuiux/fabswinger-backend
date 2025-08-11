const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware");
const {
  addProfileToHotlist,
  deleteProfileFromHotlist,
  getProfileHotlist,
} = require("../controllers/hotlistController");

router.use(authenticateToken);

router.get("/profile", getProfileHotlist);

router.post("/profile", addProfileToHotlist);

router.delete("/profile", deleteProfileFromHotlist);

module.exports = router;
