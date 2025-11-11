const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
  {
    nickname: { type: String, trim: true },
    lastName: { type: String, trim: true },
    gender: {
      type: String,
      enum: ["man", "woman", "TVTSCD", "other", "preferNotToSay"],
    },
    sexuality: {
      type: String,
      enum: [
        "straight",
        "gay",
        "bisexual",
        "asexual",
        "pansexual",
        "lesbian",
        "queer",
        "other",
        "preferNotToSay",
      ],
    },
    dateOfBirth: { type: Date },
    height: { type: Number },
    bodyType: {
      type: String,
      enum: ["athletic", "average", "chubby", "curvy", "other"],
    },
    ethnicity: {
      type: String,
      enum: [
        "white",
        "black",
        "asian",
        "latino",
        "middleEastern",
        "nativeAmerican",
        "pacificIslander",
        "other",
      ],
    },
    tattoos: { type: Boolean, default: false },
    piercings: { type: Boolean, default: false },
    drinker: { type: Boolean, default: false },
    smoker: { type: Boolean, default: false },
  },
  { _id: false }
);

module.exports = partnerSchema;
