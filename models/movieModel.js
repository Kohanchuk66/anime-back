const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const MovieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    releaseYear: {
      type: Number,
    },
    genre: [
      {
        type: String,
        trim: true,
      },
    ],
    rating: {
      type: Number,
      min: 0,
      max: 10,
    },
    tags: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Tag",
        default: [],
      },
    ],
  },
  { timestamps: true }
);

MovieSchema.plugin(AutoIncrement, { inc_field: "MovieID" });

MovieSchema.set("toObject", { virtuals: true });
MovieSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Movie", MovieSchema);
