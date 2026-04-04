// server/userProfileAggregator.js
// ─────────────────────────────────────────────────────────────
// Real-time user taste profile builder.
//
// After each new event is logged, this module schedules
// a debounced (30s) aggregation job per user. It reads
// their last 100 events, computes weighted preference
// scores for artists / genres / languages, then upserts
// the user_profiles document in MongoDB.
//
// Scoring weights:
//   like     → +5
//   repeat   → +4
//   complete → +3
//   play     → +1
//   skip     → -0.5
// ─────────────────────────────────────────────────────────────

const { UserEvent, UserProfile, isMongoReady } = require("./mongodb");

// ── Per-user debounce timers ──────────────────────────────────
const _debounceTimers = new Map(); // userId → NodeJS.Timeout

const EVENT_WEIGHTS = {
  like:     5,
  repeat:   4,
  complete: 3,
  play:     1,
  skip:     -0.5,
};

const MAX_EVENTS_FOR_PROFILE = 100; // look back window
const DEBOUNCE_MS            = 30_000; // 30 seconds

/**
 * Schedule a profile rebuild for `userId`.
 * Calling this multiple times within 30s collapses into one rebuild.
 *
 * @param {string} userId
 */
function scheduleProfileRebuild(userId) {
  if (!userId || !isMongoReady()) return;

  // Cancel any pending rebuild for this user
  if (_debounceTimers.has(userId)) {
    clearTimeout(_debounceTimers.get(userId));
  }

  const timer = setTimeout(async () => {
    _debounceTimers.delete(userId);
    await _rebuildProfile(userId);
  }, DEBOUNCE_MS);

  _debounceTimers.set(userId, timer);
}

/**
 * Core aggregation — reads last N events and rebuilds taste profile.
 * @param {string} userId
 */
async function _rebuildProfile(userId) {
  try {
    const events = await UserEvent.find({ userId })
      .sort({ createdAt: -1 })
      .limit(MAX_EVENTS_FOR_PROFILE)
      .lean();

    if (!events.length) return;

    const artistWeights = {};
    const genreWeights  = {};
    const langWeights   = {};
    const songScores    = {};  // songId → cumulative score

    for (const ev of events) {
      const weight = EVENT_WEIGHTS[ev.event] ?? 0;
      if (weight === 0) continue;

      const { artist = "", genre = "", language = "" } = ev.songMeta || {};
      const songId = ev.songId;

      // Accumulate weights
      if (artist)   artistWeights[artist.toLowerCase()]   = (artistWeights[artist.toLowerCase()]   || 0) + weight;
      if (genre)    genreWeights[genre.toLowerCase()]     = (genreWeights[genre.toLowerCase()]     || 0) + weight;
      if (language) langWeights[language.toLowerCase()]   = (langWeights[language.toLowerCase()]   || 0) + weight;
      if (songId)   songScores[songId]                    = (songScores[songId]                    || 0) + weight;
    }

    // Top-50 songs by score (descending)
    const topSongIds = Object.entries(songScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([id]) => id);

    await UserProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          artistWeights:  artistWeights,
          genreWeights:   genreWeights,
          langWeights:    langWeights,
          topSongIds,
          totalEvents:    events.length,
          lastUpdated:    new Date(),
        },
      },
      { upsert: true, new: true }
    );

    console.log(`[PROFILE] ✅ Rebuilt taste profile for user ${userId.slice(0, 8)}… (${events.length} events)`);
  } catch (err) {
    console.error("[PROFILE] ❌ Failed to rebuild profile:", err.message);
  }
}

/**
 * Fetch the current taste profile for a user.
 * Returns null if no profile exists or MongoDB is unavailable.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getUserProfile(userId) {
  if (!userId || !isMongoReady()) return null;
  try {
    return await UserProfile.findOne({ userId }).lean();
  } catch (err) {
    console.error("[PROFILE] ❌ getUserProfile error:", err.message);
    return null;
  }
}

module.exports = { scheduleProfileRebuild, getUserProfile };
