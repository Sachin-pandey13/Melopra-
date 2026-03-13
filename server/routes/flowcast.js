// server/routes/flowcast.js
require("dotenv").config();
const express = require("express");
const router = express.Router();

// Node 18+ fetch
const YT_KEY = process.env.YOUTUBE_API_KEY;
if (!YT_KEY) console.error("❌ Missing YOUTUBE_API_KEY in .env");

// ⚠️ CHEAP ENDPOINT → 1 quota unit (NOT 100!)
router.get("/", async (req, res) => {
  const { channelId } = req.query;
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet&chart=mostPopular&maxResults=15&regionCode=IN&` +
      `channelId=${channelId}&key=${YT_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    // Convert to JSON safely
    let data;
    try { data = JSON.parse(text); }
    catch {
      return res.status(500).json({ error: "invalid_json_from_youtube" });
    }

    // Quota exceeded but don't crash
    if (data?.error?.errors?.[0]?.reason === "quotaExceeded") {
      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: "Daily YouTube quota reached. Showing cached / limited data instead."
      });
    }

    const items = data?.items || [];
    if (!items.length) {
      return res.json({ channelId, channelName: "Unknown", cover: null, songs: [] });
    }

    // Metadata
    const first = items[0];
    const channelName = first.snippet?.channelTitle || "Unknown";
    const cover = first.snippet?.thumbnails?.high?.url || null;

    // 🚫 Filter garbage (shorts/trailers/live)
    const songs = items
      .filter(v => v.id) // valid ID only
      .filter(v => {
        const t = v.snippet?.title?.toLowerCase() || "";
        return (
          !t.includes("short") && 
          !t.includes("#shorts") &&
          !t.includes("trailer") &&
          v.snippet?.liveBroadcastContent !== "live"
        );
      })
      .map(v => ({
        id: v.id,
        title: v.snippet.title,
        artist: channelName,
        image: v.snippet?.thumbnails?.high?.url || null,
        audio: `https://www.youtube.com/watch?v=${v.id}`,
        channelId
      }));

    return res.json({ channelId, channelName, cover, songs });

  } catch (err) {
    console.error("⚠️ FlowCast server error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

module.exports = router;
