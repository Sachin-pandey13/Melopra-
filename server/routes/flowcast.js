// server/routes/flowcast.js
// Integrated with: cache (15 min TTL) + quota manager + inflight dedup
require("dotenv").config();
const express = require("express");
const router  = express.Router();

const { flowcastCache, cacheKey, TTL } = require("../cache");
const { canUseYoutube, consumeYoutube, markYoutubeExhausted } = require("../quotaManager");
const { inflightFlowcast } = require("../inflight");

const YT_KEY = process.env.YOUTUBE_API_KEY;
if (!YT_KEY) console.error("❌ Missing YOUTUBE_API_KEY in .env");

// ⚠️ CHEAP ENDPOINT → 1 quota unit (NOT 100!)
router.get("/", async (req, res) => {
  const { channelId } = req.query;
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const key = cacheKey("flowcast", channelId);

  // ── 1. Cache hit ────────────────────────────────────────────
  const cached = flowcastCache.get(key);
  if (cached) {
    console.log(`[CACHE HIT] flowcast: ${channelId}`);
    res.setHeader("X-Cache", "HIT");
    return res.json(cached);
  }

  // ── 2. Quota guard ──────────────────────────────────────────
  const quota = canUseYoutube(1); // videos.list costs 1 unit
  if (!quota.allowed) {
    console.warn(`[QUOTA] YouTube at ${quota.percentUsed}% — serving stale/empty for ${channelId}`);
    // Return empty gracefully — client falls back to local cache
    return res.status(429).json({
      error:   "QUOTA_EXCEEDED",
      message: "Daily YouTube quota reached. Showing cached / limited data instead.",
      quota:   { used: quota.used, budget: quota.budget },
    });
  }

  try {
    // ── 3. In-flight deduplication ─────────────────────────────
    const data = await inflightFlowcast.dedupe(key, async () => {
      const url =
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet&chart=mostPopular&maxResults=15&regionCode=IN&` +
        `channelId=${channelId}&key=${YT_KEY}`;

      const response = await fetch(url);
      const text     = await response.text();

      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error("invalid_json_from_youtube"); }

      // Quota exceeded — mark exhausted so we stop calling
      if (parsed?.error?.errors?.[0]?.reason === "quotaExceeded") {
        markYoutubeExhausted();
        throw Object.assign(new Error("QUOTA_EXCEEDED"), { isQuota: true });
      }

      // Record consumption only on successful call
      consumeYoutube(1);

      const items = parsed?.items || [];
      if (!items.length) {
        return { channelId, channelName: "Unknown", cover: null, songs: [] };
      }

      const first       = items[0];
      const channelName = first.snippet?.channelTitle || "Unknown";
      const cover       = first.snippet?.thumbnails?.high?.url || null;

      const songs = items
        .filter(v => v.id)
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
          id:        v.id,
          title:     v.snippet.title,
          artist:    channelName,
          image:     v.snippet?.thumbnails?.high?.url || null,
          audio:     `https://www.youtube.com/watch?v=${v.id}`,
          channelId,
        }));

      return { channelId, channelName, cover, songs };
    });

    // ── 4. Store in cache ──────────────────────────────────────
    flowcastCache.set(key, data, TTL.FLOWCAST);
    res.setHeader("X-Cache", "MISS");
    return res.json(data);

  } catch (err) {
    if (err.isQuota) {
      return res.status(429).json({
        error:   "QUOTA_EXCEEDED",
        message: "Daily YouTube quota reached. Showing cached / limited data instead.",
      });
    }
    if (err.message === "invalid_json_from_youtube") {
      return res.status(500).json({ error: "invalid_json_from_youtube" });
    }
    console.error("⚠️ FlowCast server error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

module.exports = router;
