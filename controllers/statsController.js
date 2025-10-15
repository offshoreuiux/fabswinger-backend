const { getOnlineUsers } = require("../utils/socket");

// Return online user count from in-memory socket tracker
const getOnlineUserCount = async (req, res) => {
  try {
    // Return from in-memory map directly for accurate count
    const users = (await getOnlineUsers(100000)) || [];
    const count = users.length;
    return res.json({ onlineUsers: count });
  } catch (error) {
    console.error("Error in getOnlineUserCount:", error);
    return res
      .status(500)
      .json({ error: "Server error while fetching online users" });
  }
};

module.exports = { getOnlineUserCount };
