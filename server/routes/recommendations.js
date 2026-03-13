const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/recommendations", async (req, res) => {
  try {
    const { seedTitle, seedArtist, seedGenre, seedLang } = req.query;

    if (!seedTitle) {
      return res.status(400).json({ error: "seedTitle required" });
    }

    const payload = {
      title: seedTitle || "",
      channel: seedArtist || "",
      description: "",
      tags: [seedGenre, seedLang].filter(Boolean),
    };

    const response = await axios.post(
      "http://localhost:8000/recommend",
      payload
    );

    const songs = response.data.songs.map((s) => ({
      id: `yt-${s.id}`,
      title: s.title,
      artist: s.channel,
      image:
        s.thumbnail ||
        `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`,
      audio: s.youtubeUrl,
      category: "YouTube",
    }));

    return res.json({ songs });
  } catch (err) {
    console.error("❌ recommendation error:", err.message);
    return res.status(500).json({ error: "recommendation failed" });
  }
});

module.exports = router;