// server/routes/recommendations.js
// Integrated with: cache (10 min TTL) + in-flight dedup + retry logic
const express = require("express");
const axios   = require("axios");

const { recommendCache, cacheKey, TTL } = require("../cache");
const { inflightRecommendations }        = require("../inflight");

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Retry an async function up to `maxAttempts` times with exponential backoff.
 * @param {function():Promise} fn
 * @param {number} maxAttempts
 * @param {number} baseDelayMs
 * @returns {Promise<*>}
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 300) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 300, 600, 1200 ms
        console.warn(`[RETRY] recommendations attempt ${attempt} failed — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────

router.get("/recommendations", async (req, res) => {
  try {
    const { seedTitle = "", seedArtist = "", seedGenre = "", seedLang = "" } = req.query;

    if (!seedTitle) {
      return res.status(400).json({ error: "seedTitle required" });
    }

    const key = cacheKey("recommend", seedTitle, seedArtist, seedGenre, seedLang);

    // ── 1. Cache hit ──────────────────────────────────────────
    const cached = recommendCache.get(key);
    if (cached) {
      console.log(`[CACHE HIT] recommendations: ${seedTitle}`);
      res.setHeader("X-Cache", "HIT");
      return res.json({ songs: cached });
    }

    // ── 2. In-flight dedup + retry ────────────────────────────
    const songs = await inflightRecommendations.dedupe(key, () =>
      withRetry(async () => {
        const payload = {
          title:       seedTitle,
          channel:     seedArtist,
          description: "",
          tags:        [seedGenre, seedLang].filter(Boolean),
        };

        const response = await axios.post(
          "http://localhost:8000/recommend",
          payload,
          { timeout: 8000 } // ← prevent hanging forever
        );

        return response.data.songs.map(s => ({
          id:       `yt-${s.id}`,
          title:    s.title,
          artist:   s.channel,
          image:    s.thumbnail || `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`,
          audio:    s.youtubeUrl,
          category: "YouTube",
        }));
      })
    );

    // ── 3. Store in cache ─────────────────────────────────────
    recommendCache.set(key, songs, TTL.RECOMMENDATIONS);
    res.setHeader("X-Cache", "MISS");
    return res.json({ songs });

  } catch (err) {
    console.error("❌ recommendation error:", err.message);
    return res.status(500).json({ error: "recommendation failed" });
  }
});

module.exports = router;