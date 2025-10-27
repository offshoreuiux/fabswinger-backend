const express = require("express");
const router = express.Router();
const { authenticateToken, requireAdmin } = require("../../middleware");
const {
  listUsers,
  toggleUserActivation,
  verifyVerification,
  fetchVerificationRequests,
  getVerificationStats,
} = require("../../controllers/admin/adminController");
const {
  createReport,
  getReports,
} = require("../../controllers/admin/ReportController");

router.use(authenticateToken);

router.post("/reports", createReport);

router.use(requireAdmin);

router.get("/users", listUsers);

router.post("/users/:userId/toggle-user-activation", toggleUserActivation);

router.get("/reports", getReports);

router.get("/users/verification-requests", fetchVerificationRequests);

router.post("/users/:verificationId/verify-verification", verifyVerification);

router.get("/verification-stats", getVerificationStats);

module.exports = router;
