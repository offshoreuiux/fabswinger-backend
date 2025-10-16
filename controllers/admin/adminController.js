const User = require("../../models/user/UserSchema");

// GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(
        { role: "user" },
        {
          username: 1,
          email: 1,
          lastSeen: 1,
          isActive: 1,
          createdAt: 1,
          profileImage: 1,
        }
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({}),
    ]);

    const hasMore = page * limit < total;
    res.json({ users, total, page, hasMore });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// POST /api/admin/users/:userId/toggle-user-activation
const toggleUserActivation = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({
      user,
      message: user.isActive ? "User activated" : "User deactivated",
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle user activation" });
  }
};

module.exports = { listUsers, toggleUserActivation };
