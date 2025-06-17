const Movie = require("../models/movieModel");
const Tag = require("../models/tagModel");
const { slugify } = require("transliteration");

module.exports = {
  getAllMovies: async (req, res) => {
    try {
      const { search, sort, genre } = req.query;
      let query = {};
      let sortOptions = {};

      if (search) {
        query.title = new RegExp(search, "i");
      }

      if (genre) {
        query.genre = genre;
      }

      if (sort === "latest") {
        sortOptions = { createdAt: -1 };
      }
      if (sort === "oldest") {
        sortOptions = { createdAt: 1 };
      }
      if (sort === "highest_rated") {
        sortOptions = { rating: -1 };
      }

      const movies = await Movie.find(query)
        .sort(sortOptions)
        .populate("tags")
        .lean()
        .exec();

      return res.status(200).json(movies);
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: err.message });
    }
  },

  getMovie: async (req, res) => {
    try {
      const { slug } = req.params;
      const movie = await Movie.findOne({ slug })
        .populate("tags")
        .lean()
        .exec();

      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      return res.status(200).json(movie);
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: err.message });
    }
  },

  addMovie: async (req, res) => {
    try {
      const { title, description, releaseYear, genre, rating, selectedTags } =
        req.body;

      let createdTags = [];
      for (const tagItem of selectedTags) {
        let tag = await Tag.findOne({ name: tagItem.value });
        if (!tag) {
          tag = await Tag.create({
            name: tagItem.value,
            createdBy: req.user.username,
          });
        }
        createdTags.push(tag._id);
      }

      const slug = slugify(`${title}-${Date.now()}`);

      let movie = await Movie.create({
        title: title.trim(),
        slug,
        description: description?.trim() || "",
        releaseYear,
        genre,
        rating,
        tags: createdTags,
      });

      return res.status(201).json({
        movie,
        message: "Movie added successfully!",
      });
    } catch (err) {
      console.log(err.message);
      return res.status(400).json({ message: err.message });
    }
  },

  updateMovie: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, releaseYear, genre, rating, selectedTags } =
        req.body;

      let movie = await Movie.findById(id);
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      let updatedTags = [];
      for (const tagItem of selectedTags) {
        let tag = await Tag.findOne({ name: tagItem.value });
        if (!tag) {
          tag = await Tag.create({
            name: tagItem.value,
            createdBy: req.user.username,
          });
        }
        updatedTags.push(tag._id);
      }

      movie.title = title.trim();
      movie.slug = slugify(`${title}-${Date.now()}`);
      movie.description = description?.trim() || "";
      movie.releaseYear = releaseYear;
      movie.genre = genre;
      movie.rating = rating;
      movie.tags = updatedTags;

      await movie.save();

      return res.status(200).json({
        movie,
        message: "Movie updated successfully!",
      });
    } catch (err) {
      console.log(err.message);
      return res.status(400).json({ message: err.message });
    }
  },

  deleteMovie: async (req, res) => {
    try {
      const { id } = req.params;
      const movie = await Movie.findById(id);
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      await Movie.findByIdAndDelete(id);
      return res.status(200).json({
        movieId: id,
        message: "Movie deleted successfully!",
      });
    } catch (err) {
      console.log(err.message);
      return res.status(400).json({ message: err.message });
    }
  },
};
