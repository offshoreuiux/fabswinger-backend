const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware");
const {
  createChannel,
  getChannels,
  getChannelById,
  updateChannel,
} = require("../controllers/forum/channelController");
const upload = require("../middleware/upload");
const {
  addMember,
  removeMember,
} = require("../controllers/forum/memberController");
const {
  createPost,
  getPosts,
  getPostByChannelId,
  // togglePostLike,
  getPostById,
  addComment,
  getComments,
  addPostView,
} = require("../controllers/forum/postController");

router.use(authenticateToken);

router.post("/channel", createChannel);
router.get("/channel", getChannels);
router.get("/channel/:id", getChannelById);
router.put(
  "/channel/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  updateChannel
);

router.post("/channel/:id/member", addMember);
router.delete("/channel/:id/member", removeMember);

router.post("/post", upload.single("content"), createPost);
router.get("/post", getPosts);
router.get("/post/channel/:channelId", getPostByChannelId);
// router.post("/post/:postId/toggle-like", togglePostLike);
router.get("/post/:postId", getPostById);
router.post("/post/comment", addComment);
router.get("/post/comment/:postId", getComments);
router.post("/post/view", addPostView);

module.exports = router;
