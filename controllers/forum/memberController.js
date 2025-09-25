const Member = require("../../models/forum/MemberSchema");

const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const member = await Member.findOne({
      userId,
      channelId: id,
    });
    if (member) {
      return res.status(400).json({
        success: false,
        message:
          "You are already a member of this channel, you cannot join again",
      });
    }
    const newMember = await Member.create({
      userId,
      channelId: id,
      role: "member",
    });
    return res.status(201).json({
      success: true,
      message: "You have joined the channel",
      member: newMember,
      channel: newMember.channelId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const removeMember = async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  const member = await Member.findOne({
    userId,
    channelId: id,
  });
  if (!member) {
    return res.status(400).json({
      success: false,
      message: "You are not a member of this channel",
    });
  }
  if (member.role === "admin") {
    return res.status(400).json({
      success: false,
      message: "You are the admin of this channel, you cannot leave",
    });
  }
  await member.deleteOne();
  return res.status(200).json({
    success: true,
    message: "You have left the channel",
    channel: member.channelId,
  });
};

module.exports = {
  addMember,
  removeMember,
};
