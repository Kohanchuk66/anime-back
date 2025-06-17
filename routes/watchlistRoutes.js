const express = require("express");
const Watchlist = require("../models/watchlistModel");
const Anime = require("../models/animeModel");
const User = require("../models/userModel");
const { optionalAuth } = require("../middlewares/auth");
const validateAccessToken = require("../middlewares/validateAccessToken");

const router = express.Router();

// Get user's watchlists
router.get("/", validateAccessToken, async (req, res) => {
  try {
    const { username } = req.user;
    const user = await User.findOne({ username }, { __v: 0, password: 0 });
    const watchlists = await Watchlist.find({ user: user._id })
      .populate("anime.animeId", "title coverImage rating year status")
      .sort({ updatedAt: -1 });

    res.json(watchlists);
  } catch (error) {
    console.error("Get watchlists error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get public watchlists
router.get("/public", optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, userId } = req.query;

    const query = { isPublic: true };

    if (userId) {
      query.user = userId;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const watchlists = await Watchlist.find(query)
      .populate("user", "username avatar")
      .populate("anime.animeId", "title coverImage rating")
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Watchlist.countDocuments(query);

    res.json({
      watchlists,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get public watchlists error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get watchlist by ID
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const watchlist = await Watchlist.findById(req.params.id)
      .populate("user", "username avatar")
      .populate(
        "anime.animeId",
        "title coverImage rating year status episodes genres"
      );

    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user can view this watchlist
    if (
      !watchlist.isPublic &&
      (!req.user || watchlist.user._id.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ message: "This watchlist is private" });
    }

    res.json(watchlist);
  } catch (error) {
    console.error("Get watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create watchlist
router.post("/", validateAccessToken, async (req, res) => {
  try {
    const { name, description, isPublic = true, tags = [] } = req.body;
    const { username } = req.user;
    const user = await User.findOne({ username }, { __v: 0, password: 0 });

    if (!name) {
      return res.status(400).json({ message: "Watchlist name is required" });
    }

    // Check if user already has a watchlist with this name
    const existingWatchlist = await Watchlist.findOne({
      user: user._id,
      name,
    });

    if (existingWatchlist) {
      return res
        .status(400)
        .json({ message: "You already have a watchlist with this name" });
    }

    const watchlist = new Watchlist({
      user: user._id,
      name,
      description,
      isPublic,
      tags,
    });

    await watchlist.save();
    await watchlist.populate("user", "username avatar");

    res.status(201).json(watchlist);
  } catch (error) {
    console.error("Create watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update watchlist
router.put("/:id", validateAccessToken, async (req, res) => {
  try {
    const watchlist = await Watchlist.findById(req.params.id);

    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user owns the watchlist
    if (watchlist.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this watchlist" });
    }

    const { name, description, isPublic, tags } = req.body;

    // Check if new name conflicts with existing watchlist
    if (name && name !== watchlist.name) {
      const existingWatchlist = await Watchlist.findOne({
        user: req.user._id,
        name,
        _id: { $ne: watchlist._id },
      });

      if (existingWatchlist) {
        return res
          .status(400)
          .json({ message: "You already have a watchlist with this name" });
      }
      watchlist.name = name;
    }

    if (description !== undefined) watchlist.description = description;
    if (isPublic !== undefined) watchlist.isPublic = isPublic;
    if (tags !== undefined) watchlist.tags = tags;

    await watchlist.save();
    await watchlist.populate("user", "username avatar");
    await watchlist.populate(
      "anime.animeId",
      "title coverImage rating year status"
    );

    res.json(watchlist);
  } catch (error) {
    console.error("Update watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete watchlist
router.delete("/:id", validateAccessToken, async (req, res) => {
  try {
    const watchlist = await Watchlist.findById(req.params.id);

    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user owns the watchlist
    if (watchlist.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this watchlist" });
    }

    await Watchlist.findByIdAndDelete(req.params.id);
    res.json({ message: "Watchlist deleted successfully" });
  } catch (error) {
    console.error("Delete watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add anime to watchlist
router.post("/:id/anime/:animeId", validateAccessToken, async (req, res) => {
  try {
    const { status = "plan-to-watch", userRating, progress = 0 } = req.body;

    const watchlist = await Watchlist.findById(req.params.id);
    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user owns the watchlist
    if (watchlist.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this watchlist" });
    }

    // Check if anime exists
    const anime = await Anime.findById(req.params.animeId);
    if (!anime) {
      return res.status(404).json({ message: "Anime not found" });
    }

    // Check if anime is already in the watchlist
    const existingAnime = watchlist.anime.find(
      (item) => item.animeId.toString() === req.params.animeId
    );

    if (existingAnime) {
      return res
        .status(400)
        .json({ message: "Anime is already in this watchlist" });
    }

    // Add anime to watchlist
    watchlist.anime.push({
      animeId: req.params.animeId,
      status,
      userRating,
      progress,
    });

    await watchlist.save();
    await watchlist.populate(
      "anime.animeId",
      "title coverImage rating year status episodes"
    );

    res.json(watchlist);
  } catch (error) {
    console.error("Add anime to watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update anime in watchlist
router.put("/:id/anime/:animeId", validateAccessToken, async (req, res) => {
  try {
    const { status, userRating, progress } = req.body;

    const watchlist = await Watchlist.findById(req.params.id);
    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user owns the watchlist
    if (watchlist.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this watchlist" });
    }

    // Find anime in watchlist
    const animeItem = watchlist.anime.find(
      (item) => item.animeId.toString() === req.params.animeId
    );

    if (!animeItem) {
      return res
        .status(404)
        .json({ message: "Anime not found in this watchlist" });
    }

    // Update anime item
    if (status !== undefined) animeItem.status = status;
    if (userRating !== undefined) animeItem.userRating = userRating;
    if (progress !== undefined) animeItem.progress = progress;

    await watchlist.save();
    await watchlist.populate(
      "anime.animeId",
      "title coverImage rating year status episodes"
    );

    res.json(watchlist);
  } catch (error) {
    console.error("Update anime in watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Remove anime from watchlist
router.delete("/:id/anime/:animeId", validateAccessToken, async (req, res) => {
  try {
    const watchlist = await Watchlist.findById(req.params.id);
    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // Check if user owns the watchlist
    if (watchlist.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this watchlist" });
    }

    // Remove anime from watchlist
    watchlist.anime = watchlist.anime.filter(
      (item) => item.animeId.toString() !== req.params.animeId
    );

    await watchlist.save();
    res.json({ message: "Anime removed from watchlist successfully" });
  } catch (error) {
    console.error("Remove anime from watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Follow/unfollow watchlist
router.post("/:id/follow", validateAccessToken, async (req, res) => {
  try {
    const watchlist = await Watchlist.findById(req.params.id);
    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    if (!watchlist.isPublic) {
      return res
        .status(403)
        .json({ message: "Cannot follow private watchlist" });
    }

    const userId = req.user._id;
    const isFollowing = watchlist.followers.includes(userId);

    if (isFollowing) {
      watchlist.followers.pull(userId);
    } else {
      watchlist.followers.push(userId);
    }

    await watchlist.save();

    res.json({
      following: !isFollowing,
      followerCount: watchlist.followers.length,
    });
  } catch (error) {
    console.error("Follow watchlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
