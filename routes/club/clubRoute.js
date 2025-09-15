const express = require("express");

const router = express.Router();

const { authenticateToken } = require("../../middleware");
const {
  createClub,
  getClubs,
  updateClub,
  deleteClub,
  getClubById,
} = require("../../controllers/club/clubController");
const upload = require("../../middleware/upload");
router.use(authenticateToken);

router.post("/", upload.single("image"), createClub);
router.get("/", getClubs);
router.put("/:id", upload.single("image"), updateClub);
router.delete("/:id", deleteClub);
router.get("/:id", getClubById);

module.exports = router;
