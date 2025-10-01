const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  verifyToken,
  forgotPassword,
  verifyPasswordResetCode,
  resetPassword,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify", authenticateToken, verifyToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);

module.exports = router;
