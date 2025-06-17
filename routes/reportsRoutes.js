const express = require("express");
const Report = require("../models/reportModel");
const { auth, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Create report
router.post("/", auth, async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;

    if (!targetType || !targetId || !reason) {
      return res
        .status(400)
        .json({ message: "Target type, target ID, and reason are required" });
    }

    // Determine target model based on type
    let targetModel;
    switch (targetType) {
      case "user":
        targetModel = "User";
        break;
      case "review":
        targetModel = "Review";
        break;
      case "news":
        targetModel = "News";
        break;
      default:
        return res.status(400).json({ message: "Invalid target type" });
    }

    // Check if user already reported this target
    const existingReport = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
    });

    if (existingReport) {
      return res
        .status(400)
        .json({ message: "You have already reported this content" });
    }

    const report = new Report({
      reporter: req.user._id,
      targetType,
      targetId,
      targetModel,
      reason,
      description,
    });

    await report.save();
    await report.populate("reporter", "username");

    res.status(201).json(report);
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all reports (admin/moderator only)
router.get("/", auth, requireRole(["admin", "moderator"]), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      targetType,
      reason,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (targetType) {
      query.targetType = targetType;
    }

    if (reason) {
      query.reason = reason;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const reports = await Report.find(query)
      .populate("reporter", "username avatar")
      .populate("reviewedBy", "username")
      .populate({
        path: "targetId",
        select: "title username content name", // Different fields for different models
      })
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get report by ID
router.get(
  "/:id",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id)
        .populate("reporter", "username avatar email")
        .populate("reviewedBy", "username")
        .populate({
          path: "targetId",
          select: "title username content name email bio",
        });

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Get report error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update report status
router.put(
  "/:id",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const { status, resolution, actionTaken } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (status !== undefined) {
        report.status = status;
        if (status !== "pending") {
          report.reviewedBy = req.user._id;
          report.reviewedAt = new Date();
        }
      }

      if (resolution !== undefined) report.resolution = resolution;
      if (actionTaken !== undefined) report.actionTaken = actionTaken;

      await report.save();
      await report.populate("reporter", "username avatar");
      await report.populate("reviewedBy", "username");

      res.json(report);
    } catch (error) {
      console.error("Update report error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete report
router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Delete report error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get report statistics
router.get(
  "/stats/overview",
  auth,
  requireRole(["admin", "moderator"]),
  async (req, res) => {
    try {
      const stats = await Report.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const reasonStats = await Report.aggregate([
        {
          $group: {
            _id: "$reason",
            count: { $sum: 1 },
          },
        },
      ]);

      const typeStats = await Report.aggregate([
        {
          $group: {
            _id: "$targetType",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalReports = await Report.countDocuments();
      const pendingReports = await Report.countDocuments({ status: "pending" });

      res.json({
        total: totalReports,
        pending: pendingReports,
        statusBreakdown: stats,
        reasonBreakdown: reasonStats,
        typeBreakdown: typeStats,
      });
    } catch (error) {
      console.error("Get report stats error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
