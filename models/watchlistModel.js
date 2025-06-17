const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
      default: "",
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    anime: [
      {
        animeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Anime",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: [
            "watching",
            "completed",
            "on-hold",
            "dropped",
            "plan-to-watch",
          ],
          default: "plan-to-watch",
        },
        userRating: {
          type: Number,
          min: 1,
          max: 10,
        },
        progress: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Ensure unique watchlist names per user
watchlistSchema.index({ user: 1, name: 1 }, { unique: true });

// Virtual for anime count
watchlistSchema.virtual("animeCount").get(function () {
  return this.anime.length;
});

// Virtual for follower count
watchlistSchema.virtual("followerCount").get(function () {
  return this.followers.length;
});

module.exports = mongoose.model("Watchlist", watchlistSchema);
