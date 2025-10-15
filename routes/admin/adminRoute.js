const express = require("express");
const router = express.Router();
const { authenticateToken, requireAdmin } = require("../../middleware");
const {
  listUsers,
  toggleUserActivation,
} = require("../../controllers/admin/adminController");
const {
  createReport,
  getReports,
} = require("../../controllers/admin/ReportController");

router.use(authenticateToken);

router.post("/reports", createReport);

router.use(requireAdmin);

// Admin-only: list all users with basic info
router.get("/users", listUsers);

// Admin-only: toggle user activation
router.post("/users/:userId/toggle-user-activation", toggleUserActivation);

// Admin-only: create report

// Admin-only: get reports
router.get("/reports", getReports);

module.exports = router;
