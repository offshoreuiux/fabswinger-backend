const express = require("express");
const router = express.Router();
const { signup, login, verifyToken } = require("../controllers/authController");
const { authenticateToken } = require("../middleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify", authenticateToken, verifyToken);

module.exports = router;
