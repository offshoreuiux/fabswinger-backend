const express = require("express");
const {
  startAgeOver18VerifyUser,
  callbackAgeOver18VerifyUser,
  userImageVerification,
  clubVerification,
} = require("../controllers/verificationController");
const router = express.Router();
const upload = require("../middleware/upload");

router.get("/start/:userId/:email", startAgeOver18VerifyUser);

router.get("/callback", callbackAgeOver18VerifyUser);

router.post(
  "/user-image-verification",
  upload.single("verificationImage"),
  userImageVerification
);

router.post("/club-verification", clubVerification);

module.exports = router;
