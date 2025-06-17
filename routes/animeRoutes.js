const express = require("express");
const Anime = require("../models/animeModel");
const { auth, requireRole, optionalAuth } = require("../middlewares/auth");

const router = express.Router();

// Get all anime with search and filters
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      genres,
      status,
      year,
      sortBy = "rating",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Genre filter
    if (genres) {
      const genreArray = genres.split(",");
      query.genres = { $in: genreArray };
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Year filter
    if (year) {
      query.year = parseInt(year);
    }

    // Sort options
    const sortOptions = {};
    switch (sortBy) {
      case "rating":
        sortOptions.rating = sortOrder === "asc" ? 1 : -1;
        break;
      case "year":
        sortOptions.year = sortOrder === "asc" ? 1 : -1;
        break;
      case "title":
        sortOptions.title = sortOrder === "asc" ? 1 : -1;
        break;
      case "episodes":
        sortOptions.episodes = sortOrder === "asc" ? 1 : -1;
        break;
      case "views":
        sortOptions.viewCount = sortOrder === "asc" ? 1 : -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const anime = await Anime.find(query)
      .populate("addedBy", "username")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Anime.countDocuments(query);

    res.json({
      anime,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get anime error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get anime by ID
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id).populate(
      "addedBy",
      "username"
    );

    if (!anime) {
      return res.status(404).json({ message: "Anime not found" });
    }

    // Increment view count
    anime.viewCount += 1;
    await anime.save();

    res.json(anime);
  } catch (error) {
    console.error("Get anime error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new anime
router.post(
  "/",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const {
        title,
        synopsis,
        coverImage,
        bannerImage,
        episodes,
        status,
        genres,
        year,
        studio,
        characters = [],
      } = req.body;

      // Validation
      if (
        !title ||
        !synopsis ||
        !coverImage ||
        !episodes ||
        !status ||
        !genres ||
        !year ||
        !studio
      ) {
        return res
          .status(400)
          .json({ message: "All required fields must be provided" });
      }

      const anime = new Anime({
        title,
        synopsis,
        coverImage,
        bannerImage,
        episodes,
        status,
        genres,
        year,
        studio,
        characters,
        addedBy: req.user._id,
      });

      await anime.save();
      await anime.populate("addedBy", "username");

      res.status(201).json(anime);
    } catch (error) {
      console.error("Create anime error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update anime
router.put(
  "/:id",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const anime = await Anime.findById(req.params.id);

      if (!anime) {
        return res.status(404).json({ message: "Anime not found" });
      }

      const allowedUpdates = [
        "title",
        "synopsis",
        "coverImage",
        "bannerImage",
        "episodes",
        "status",
        "genres",
        "year",
        "studio",
        "characters",
      ];

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          anime[field] = req.body[field];
        }
      });

      await anime.save();
      await anime.populate("addedBy", "username");

      res.json(anime);
    } catch (error) {
      console.error("Update anime error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete anime
router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const anime = await Anime.findById(req.params.id);

    if (!anime) {
      return res.status(404).json({ message: "Anime not found" });
    }

    await Anime.findByIdAndDelete(req.params.id);
    res.json({ message: "Anime deleted successfully" });
  } catch (error) {
    console.error("Delete anime error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unique genres
router.get("/meta/genres", async (req, res) => {
  try {
    const genres = await Anime.distinct("genres");
    res.json(genres.sort());
  } catch (error) {
    console.error("Get genres error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unique studios
router.get("/meta/studios", async (req, res) => {
  try {
    const studios = await Anime.distinct("studio.name");
    res.json(studios.sort());
  } catch (error) {
    console.error("Get studios error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
