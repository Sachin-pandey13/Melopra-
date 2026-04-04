// client/src/api/getPersonalizedFeed.js
// ─────────────────────────────────────────────────────────────
// Fetches the personalized song feed for the current user.
//
// Behaviour:
//   - Calls  GET /api/personalized-feed?userId=&limit=20
//   - If personalization is unavailable (cold start / ML down)
//     falls back to getRecommendations() silently
//   - Client-side TTL cache (5 min) per userId
//   - In-flight deduplication via dedupeRequest
// ─────────────────────────────────────────────────────────────
import { recommendationsCache, CLIENT_TTL, dedupeRequest, buildKey } from "../utils/apiCache";
import { getRecommendations } from "./getRecommendations";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Get personalized feed for the given user.
 *
 * @param {string}      userId   Firebase UID
 * @param {object|null} seedSong Fallback seed if personalization unavailable
 * @param {number}      limit    Max songs to return (default 20)
 * @returns {Promise<{ songs: Array, personalized: boolean }>}
 */
export async function getPersonalizedFeed(userId, seedSong = null, limit = 20) {
  if (!userId) return { songs: [], personalized: false };

  const key = buildKey("personal-feed", userId);

  // ── 1. Client cache hit ──────────────────────────────────────
  const cached = recommendationsCache.get(key);
  if (cached) {
    console.log("[CLIENT CACHE HIT] personalized-feed:", userId.slice(0, 8));
    return { songs: cached, personalized: true, fromCache: true };
  }

  // ── 2. Deduplicated server fetch ──────────────────────────────
  try {
    const result = await dedupeRequest(key, async () => {
      const url = `${BASE_URL}/api/personalized-feed?userId=${encodeURIComponent(userId)}&limit=${limit}`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

    // ── 3. Personalized songs returned ──────────────────────────
    if (result.personalized && Array.isArray(result.songs) && result.songs.length > 0) {
      recommendationsCache.set(key, result.songs, CLIENT_TTL.RECOMMENDATIONS);
      return { songs: result.songs, personalized: true };
    }

    // ── 4. Cold-start or ML unavailable → fall back ───────────
    console.info(
      `[PERSONALIZED] Cold start (${result.eventsLogged ?? 0}/${result.eventsNeeded ?? 5} events). Using generic recommendations.`
    );

    if (seedSong) {
      const fallback = await getRecommendations(userId, seedSong);
      return { songs: fallback, personalized: false, coldStart: true };
    }

    return { songs: [], personalized: false, coldStart: true };

  } catch (err) {
    console.warn("[PERSONALIZED] Feed fetch error:", err.message);
    // Final fallback — generic recommendations
    if (seedSong) {
      try {
        const fallback = await getRecommendations(userId, seedSong);
        return { songs: fallback, personalized: false };
      } catch { /* silent */ }
    }
    return { songs: [], personalized: false };
  }
}
