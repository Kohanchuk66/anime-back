const express = require("express");
const router = express.Router();
const animeController = require("../controllers/animeController");
const validateAccessToken = require("../middlewares/validateAccessToken");

// Все аниме
router.get("/", animeController.getAllAnime);

// Админ действия
router.post("/", validateAccessToken, animeController.addAnime);
router.put("/:id", validateAccessToken, animeController.updateAnime);
router.delete("/:id", validateAccessToken, animeController.deleteAnime);

// Отметка "просмотрено"
router.put("/watch/:animeId", validateAccessToken, animeController.markAsWatched);

module.exports = router;
