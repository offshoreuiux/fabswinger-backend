const express = require("express");
const {
  getFriendList,
  addFriend,
  removeFriend,
  blockProfile,
  acceptFriendRequest,
  rejectFriendRequest,
  getOtherUserFriendList,
} = require("../controllers/friendsController");
const router = express.Router();
const { authenticateToken } = require("../middleware");

router.use(authenticateToken);

router.get("/", getFriendList);

router.get("/other/:userId", getOtherUserFriendList);

router.post("/", addFriend);

router.put("/block", blockProfile);

router.delete("/", removeFriend);

router.put("/accept", acceptFriendRequest);

router.put("/reject", rejectFriendRequest);

module.exports = router;
