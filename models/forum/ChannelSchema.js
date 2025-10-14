const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    backgroundImage: {
      type: String,
      default: "",
      trim: true,
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
