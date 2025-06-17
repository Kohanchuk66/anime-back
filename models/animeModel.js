const mongoose = require("mongoose");

const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["main", "supporting", "minor"],
    default: "supporting",
  },
  description: {
    type: String,
    maxlength: 1000,
  },
});

const studioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  logo: String,
  founded: Number,
  description: String,
});

const animeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    synopsis: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    coverImage: {
      type: String,
      required: true,
    },
    bannerImage: String,
    episodes: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["airing", "completed", "upcoming"],
      required: true,
    },
    genres: [
      {
        type: String,
        required: true,
      },
    ],
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 5,
    },
    studio: {
      type: studioSchema,
      required: true,
    },
    characters: [characterSchema],
    totalRatings: {
      type: Number,
      default: 0,
    },
    ratingSum: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate average rating
animeSchema.methods.updateRating = function () {
  if (this.totalRatings > 0) {
    this.rating = Math.round((this.ratingSum / this.totalRatings) * 10) / 10;
  } else {
    this.rating = 0;
  }
};

// Text search index
animeSchema.index({
  title: "text",
  synopsis: "text",
  genres: "text",
  "studio.name": "text",
});

module.exports = mongoose.model("Anime", animeSchema);
