const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["user", "review", "comment", "news"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      required: true,
      enum: ["User", "Review", "News"],
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "inappropriate-content",
        "copyright-violation",
        "fake-information",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
    resolution: {
      type: String,
      maxlength: 1000,
    },
    actionTaken: {
      type: String,
      enum: ["none", "warning", "content-removed", "user-banned", "other"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Report", reportSchema);
