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
    type: {
      type: String,
      enum: ["private", "group"],
      default: "private",
    },
    name: {
      type: String,
      required: function () {
        return this.type === "group";
      },
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "group";
      },
    },
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
