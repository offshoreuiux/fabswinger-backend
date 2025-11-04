const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  verifyToken,
  forgotPassword,
  verifyPasswordResetCode,
  resetPassword,
  deleteAccount,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify", authenticateToken, verifyToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);
router.delete("/delete-account", deleteAccount);

module.exports = router;
