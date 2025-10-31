const mongoose = require("mongoose");

// Define schema
const userSchema = new mongoose.Schema(
  {
    // Basic authentication info
    stripeCustomerId: {
      type: String,
      default: null,
      required: false,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      required: false,
    },
    stripeAccountId: {
      type: String,
      default: null,
      required: false,
    },
    affiliateOf: {
      type: String,
      default: null,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Prevent accidental exposure
      trim: true,
    },
    // Profile completion
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      trim: true,
    },
    // Personal Identity
    nickname: {
      type: String,
      trim: true,
      required: false,
    },
    lastName: {
      type: String,
      trim: true,
    },
    about: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: [
        "man",
        "woman",
        "coupleMF",
        "coupleMM",
        "coupleFF",
        "TVTSCD",
        "other",
        "preferNotToSay",
      ],
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
    dateOfBirth: {
      type: Date,
      required: false,
    },

    // Geo Location for Nearby Filter
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
    },
    location: {
      type: String,
      trim: true,
    },
    postcode: {
      type: String,
      trim: true,
    },
    firstHalfPostcode: {
      type: String,
      trim: true,
    },
    town: {
      type: String,
      trim: true,
    },

    // Appearance & Lifestyle
    height: {
      type: Number, // in cm
    },
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

    tattoos: {
      type: Boolean,
      default: false,
    },
    piercings: {
      type: Boolean,
      default: false,
    },
    drinker: {
      type: Boolean,
      default: false,
    },
    smoker: {
      type: Boolean,
      default: false,
    },
    openToTravel: {
      type: Boolean,
      default: false,
    },
    openToAccommodate: {
      type: Boolean,
      default: false,
    },

    // Match Preferences
    lookingFor: [
      {
        type: String,
        enum: ["man", "woman", "coupleMF", "coupleMM", "coupleFF", "TVTSCD"],
      },
    ],
    ageRange: {
      min: {
        type: Number,
        default: 18,
      },
      max: {
        type: Number,
        default: 65,
      },
    },
    preferences: {
      nonSmoker: {
        type: Boolean,
        default: false,
      },
      nonDrinker: {
        type: Boolean,
        default: false,
      },
      openToTravel: {
        type: Boolean,
        default: false,
      },
      openToAccommodate: {
        type: Boolean,
        default: false,
      },
    },

    // Profile images
    profileImage: {
      type: String,
      default: "",
      trim: true,
    },
    mobileNumber: {
      type: String,
      default: "",
      trim: true,
    },

    // Account status
    isVerified: {
      type: Boolean,
      default: false,
    },
    keepSignedIn: {
      type: Boolean,
      default: false,
    },
    winkInterests: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    // Online status (for real-time systems)
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    settings: {
      type: Object,
      default: {
        getPrivateMessages: true,
        getWinks: true,
        getFriendInvites: true,
        newMembersMatchMyRequirements: true,
        profileVisibility: true,
        // whosLookedAtMe: true,
        friendsListVisibility: true,
        photoFabFeature: true,
        nonMemberVisibility: true,
        reviewVisibility: true,
        // chatCameraVisibility: true,
      },
    },
    passwordResetCode: {
      type: Number,
      default: null,
    },
    passwordResetCodeExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // auto add createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ nickname: 1 });
userSchema.index({ email: 1 });
userSchema.index({ geoLocation: "2dsphere" });

userSchema.index({ passwordResetCode: 1 });
// Virtual field to calculate age from DOB
userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const ageDifMs = Date.now() - this.dateOfBirth.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
});

const User = mongoose.model("User", userSchema);
module.exports = User;
