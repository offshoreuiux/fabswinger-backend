const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { authenticateToken } = require("../middleware");
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  winkPost,
  unwinkPost,
  hotlistPost,
  unhotlistPost,
} = require("../controllers/postController");

router.post("/create", authenticateToken, upload.array("images"), createPost);
router.get("/", authenticateToken, getPosts);
router.post("/:postId/like", authenticateToken, likePost);
router.delete("/:postId/like", authenticateToken, unlikePost);
router.post("/:postId/wink", authenticateToken, winkPost);
router.delete("/:postId/wink", authenticateToken, unwinkPost);
router.post("/:postId/hotlist", authenticateToken, hotlistPost);
router.delete("/:postId/hotlist", authenticateToken, unhotlistPost);
// router.get("/:id", authenticateToken, getPostById);
// router.put("/:id", authenticateToken, updatePost);
router.delete("/:postId", authenticateToken, deletePost);

module.exports = router;
