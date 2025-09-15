const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    backgroundImage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

channelSchema.index({ createdBy: 1, name: 1 }, { unique: true });

channelSchema.virtual("members", {
  ref: "Member",
  localField: "_id",
  foreignField: "channelId",
});

channelSchema.virtual("posts", {
  ref: "ForumPost",
  localField: "_id",
  foreignField: "channelId",
});

channelSchema.set("toObject", { virtuals: true });
channelSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Channel", channelSchema);
