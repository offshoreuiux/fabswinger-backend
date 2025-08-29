const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageTime: {
      type: Date,
    },
    unreadCount: {
      type: Map,
      of: {
        type: Number,
        default: 0,
      },
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
