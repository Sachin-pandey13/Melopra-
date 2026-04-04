// server/routes/personalized.js
// ─────────────────────────────────────────────────────────────
// Personalized feed & user taste API routes.
//
// GET /api/personalized-feed?userId=&limit=20
//   → Returns ML-ranked songs personalized to the user's taste.
//   → Falls back to generic /api/recommendations for new users (<5 events).
//
// GET /api/user-taste?userId=
//   → Returns the user's aggregated taste stats (for UI display).
// ─────────────────────────────────────────────────────────────
const express = require("express");
const axios   = require("axios");
const router  = express.Router();

const { getUserProfile }                    = require("../userProfileAggregator");
const { isMongoReady, UserEvent }           = require("../mongodb");
const { recommendCache, cacheKey, TTL }     = require("../cache");
const { inflightRecommendations }           = require("../inflight");
const { rateLimitMiddleware }               = require("../quotaManager");

const ML_URL = process.env.ML_WORKER_URL || "http://localhost:8000";

// ── Minimum events before personalization kicks in ────────────
const MIN_EVENTS_FOR_PERSONALIZATION = 5;

/* -----------------------------------------------------------
 🎯 GET /api/personalized-feed
    Returns a personalized ranked list of songs.
----------------------------------------------------------- */
router.get(
  "/personalized-feed",
  rateLimitMiddleware("recommendations"),
  async (req, res) => {
    const { userId, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // Cache key includes userId for per-user isolation
    const key = cacheKey("personal-feed", userId);

    // ── 1. Cache hit ────────────────────────────────────────────
    const cached = recommendCache.get(key);
    if (cached) {
      console.log(`[CACHE HIT] personalized-feed: ${userId.slice(0, 8)}…`);
      res.setHeader("X-Cache",        "HIT");
      res.setHeader("X-Personalized", "true");
      return res.json({ songs: cached, personalized: true });
    }

    // ── 2. In-flight dedup ──────────────────────────────────────
    try {
      const result = await inflightRecommendations.dedupe(key, async () => {
        // Check if Mongo is ready and user has enough events
        if (!isMongoReady()) {
          return { songs: [], personalized: false, reason: "mongo_unavailable" };
        }

        const eventCount = await UserEvent.countDocuments({ userId });

        // ── Cold start: not enough data yet ──────────────────────
        if (eventCount < MIN_EVENTS_FOR_PERSONALIZATION) {
          return {
            songs:       [],
            personalized: false,
            reason:      "cold_start",
            eventsLogged: eventCount,
            eventsNeeded: MIN_EVENTS_FOR_PERSONALIZATION,
          };
        }

        // ── Fetch user taste profile ──────────────────────────────
        const profile = await getUserProfile(userId);
        if (!profile) {
          return { songs: [], personalized: false, reason: "no_profile" };
        }

        // ── Build request to Python personalized recommender ──────
        const topArtists = Object.entries(profile.artistWeights || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([artist]) => artist);

        const topLangs = Object.entries(profile.langWeights || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([lang]) => lang);

        const topGenres = Object.entries(profile.genreWeights || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([genre]) => genre);

        // Exclude recently played songs (last 20) from recommendations
        const recentEvents = await UserEvent.find({ userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("songId")
          .lean();
        const excludeIds = [...new Set(recentEvents.map(e => e.songId))];

        // ── Call Python ML worker ─────────────────────────────────
        const mlResponse = await axios.post(
          `${ML_URL}/personalized-recommend`,
          {
            userId,
            topArtists,
            topLangs,
            topGenres,
            excludeIds,
            limit: parseInt(limit, 10),
          },
          { timeout: 8000 }
        );

        const songs = (mlResponse.data?.songs || []).map(s => ({
          id:       `yt-${s.id}`,
          title:    s.title,
          artist:   s.artist || s.channel,
          image:    s.thumbnail || `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`,
          audio:    s.youtubeUrl || `https://www.youtube.com/watch?v=${s.id}`,
          category: "YouTube",
          score:    s.score,
        }));

        return { songs, personalized: true, topArtists, topLangs };
      });

      // ── 3. Cache (shorter TTL for personalized — changes more often) ──
      if (result.songs?.length > 0) {
        recommendCache.set(key, result.songs, TTL.RECOMMENDATIONS);
      }

      res.setHeader("X-Cache",         "MISS");
      res.setHeader("X-Personalized",  String(result.personalized));
      return res.json(result);

    } catch (err) {
      console.error("[PERSONALIZED] ❌ Feed error:", err.message);
      // Graceful degradation — tell frontend to fall back
      return res.status(502).json({
        error:       "personalization_unavailable",
        personalized: false,
        reason:      "ml_worker_error",
      });
    }
  }
);

/* -----------------------------------------------------------
 📊 GET /api/user-taste
    Returns the user's taste profile for display in the UI.
----------------------------------------------------------- */
router.get("/user-taste", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  if (!isMongoReady()) {
    return res.json({ available: false, reason: "mongo_unavailable" });
  }

  try {
    const profile = await getUserProfile(userId);
    if (!profile) {
      const count = await UserEvent.countDocuments({ userId });
      return res.json({
        available:    false,
        eventsLogged: count,
        eventsNeeded: MIN_EVENTS_FOR_PERSONALIZATION,
      });
    }

    // Format for frontend display
    const topArtists = Object.entries(profile.artistWeights || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }));

    const topGenres = Object.entries(profile.genreWeights || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }));

    const topLangs = Object.entries(profile.langWeights || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }));

    return res.json({
      available:    true,
      topArtists,
      topGenres,
      topLangs,
      totalEvents:  profile.totalEvents,
      lastUpdated:  profile.lastUpdated,
    });
  } catch (err) {
    console.error("[USER-TASTE] ❌", err.message);
    return res.status(500).json({ error: "Failed to fetch taste profile" });
  }
});

module.exports = router;
