const express = require("express");
const {
  startVerifyUser,
  callbackVerifyUser,
} = require("../controllers/verificationController");
const router = express.Router();

router.get("/start/:userId/:email", startVerifyUser);

router.get("/callback", callbackVerifyUser);

module.exports = router;
