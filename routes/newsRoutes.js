const express = require("express");
const News = require("../models/newsModel");
const { auth, requireRole, optionalAuth } = require("../middlewares/auth");

const router = express.Router();

// Get all news
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, tags } = req.query;

    const query = { isPublished: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (tags) {
      const tagArray = tags.split(",");
      query.tags = { $in: tagArray };
    }

    const news = await News.find(query)
      .populate("author", "username avatar")
      .sort({ publishedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add user-specific data if authenticated
    const newsWithUserData = news.map((article) => {
      const articleObj = article.toObject();
      articleObj.likeCount = article.likes.length;
      articleObj.isLiked = req.user
        ? article.likes.includes(req.user._id)
        : false;
      return articleObj;
    });

    const total = await News.countDocuments(query);

    res.json({
      news: newsWithUserData,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get news error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get news by ID
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const article = await News.findById(req.params.id)
      .populate("author", "username avatar")
      .populate("comments.user", "username avatar");

    if (!article) {
      return res.status(404).json({ message: "News article not found" });
    }

    if (!article.isPublished) {
      return res.status(404).json({ message: "News article not found" });
    }

    // Increment view count
    article.views += 1;
    await article.save();

    const articleObj = article.toObject();
    articleObj.likeCount = article.likes.length;
    articleObj.isLiked = req.user
      ? article.likes.includes(req.user._id)
      : false;

    res.json(articleObj);
  } catch (error) {
    console.error("Get news error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create news
router.post(
  "/",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const { title, content, image, tags = [], isPublished = true } = req.body;

      if (!title || !content) {
        return res
          .status(400)
          .json({ message: "Title and content are required" });
      }

      const article = new News({
        title,
        content,
        author: req.user._id,
        image,
        tags,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      });

      await article.save();
      await article.populate("author", "username avatar");

      res.status(201).json({
        ...article.toObject(),
        likeCount: 0,
        isLiked: false,
      });
    } catch (error) {
      console.error("Create news error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update news
router.put(
  "/:id",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const article = await News.findById(req.params.id);

      if (!article) {
        return res.status(404).json({ message: "News article not found" });
      }

      // Check if user owns the article or is admin
      if (
        article.author.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this article" });
      }

      const { title, content, image, tags, isPublished } = req.body;

      if (title !== undefined) article.title = title;
      if (content !== undefined) article.content = content;
      if (image !== undefined) article.image = image;
      if (tags !== undefined) article.tags = tags;
      if (isPublished !== undefined) {
        article.isPublished = isPublished;
        if (isPublished && !article.publishedAt) {
          article.publishedAt = new Date();
        }
      }

      await article.save();
      await article.populate("author", "username avatar");

      res.json({
        ...article.toObject(),
        likeCount: article.likes.length,
        isLiked: article.likes.includes(req.user._id),
      });
    } catch (error) {
      console.error("Update news error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete news
router.delete(
  "/:id",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const article = await News.findById(req.params.id);

      if (!article) {
        return res.status(404).json({ message: "News article not found" });
      }

      // Check if user owns the article or is admin
      if (
        article.author.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this article" });
      }

      await News.findByIdAndDelete(req.params.id);
      res.json({ message: "News article deleted successfully" });
    } catch (error) {
      console.error("Delete news error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Like/unlike news
router.post("/:id/like", auth, async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: "News article not found" });
    }

    const userId = req.user._id;
    const isLiked = article.likes.includes(userId);

    if (isLiked) {
      article.likes.pull(userId);
    } else {
      article.likes.push(userId);
    }

    await article.save();

    res.json({
      liked: !isLiked,
      likeCount: article.likes.length,
    });
  } catch (error) {
    console.error("Like news error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add comment to news
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const article = await News.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: "News article not found" });
    }

    article.comments.push({
      user: req.user._id,
      content,
    });

    await article.save();
    await article.populate("comments.user", "username avatar");

    const newComment = article.comments[article.comments.length - 1];
    res.status(201).json(newComment);
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete comment
router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: "News article not found" });
    }

    const comment = article.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user owns the comment or is admin/moderator
    if (
      comment.user.toString() !== req.user._id.toString() &&
      !["admin", "moderator"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    comment.remove();
    await article.save();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all tags
router.get("/meta/tags", async (req, res) => {
  try {
    const tags = await News.distinct("tags");
    res.json(tags.sort());
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
