// client/src/api/getRecommendations.js
// ──────────────────────────────────────────────────────────────
// Optimized with:
//   ✅ Client-side TTL cache (5 min) by seedId
//   ✅ In-flight deduplication via dedupeRequest
//   ✅ Skips fetch entirely if same seed requested within TTL window
// ──────────────────────────────────────────────────────────────
import {
  recommendationsCache,
  CLIENT_TTL,
  dedupeRequest,
  buildKey,
} from "../utils/apiCache";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Fetch song recommendations for a given user + seed song.
 * Results are cached client-side for 5 minutes per seed.
 *
 * @param {string} userId
 * @param {object|null} seedSong
 * @returns {Promise<Array>}
 */
export async function getRecommendations(userId, seedSong = null) {
  if (!userId) return [];

  try {
    const seedTitle  = seedSong?.title    || "";
    const seedArtist = seedSong?.artist   || "";
    const seedGenre  = seedSong?.genre    || "";
    const seedLang   = seedSong?.lang     || seedSong?.language || "";

    // 🔥 Normalize seedId (remove yt- / firestore- prefix)
    let seedId = seedSong?.id || "";
    if (seedId.startsWith("yt-"))        seedId = seedId.replace("yt-", "");
    if (seedId.startsWith("firestore-")) seedId = seedId.replace("firestore-", "");

    // Build a stable cache key from all seed parameters
    const key = buildKey("recommend", seedId, seedTitle, seedArtist, seedGenre, seedLang);

    // ── 1. Client cache hit ──────────────────────────────────────
    const cached = recommendationsCache.get(key);
    if (cached) {
      console.log("[CLIENT CACHE HIT] recommendations:", seedTitle);
      return cached;
    }

    // ── 2. Deduplicated fetch ─────────────────────────────────────
    const url =
      `${BASE_URL}/api/recommendations?` +
      `userId=${encodeURIComponent(userId)}` +
      `&seedTitle=${encodeURIComponent(seedTitle)}` +
      `&seedArtist=${encodeURIComponent(seedArtist)}` +
      `&seedGenre=${encodeURIComponent(seedGenre)}` +
      `&seedLang=${encodeURIComponent(seedLang)}` +
      `&seedId=${encodeURIComponent(seedId)}`;

    const songs = await dedupeRequest(key, async () => {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Recommendations request failed:", res.status);
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data.songs)) {
        console.warn("Invalid recommendations response:", data);
        return [];
      }
      return data.songs;
    });

    // ── 3. Store in client cache ──────────────────────────────────
    if (songs.length > 0) {
      recommendationsCache.set(key, songs, CLIENT_TTL.RECOMMENDATIONS);
    }

    return songs;
  } catch (err) {
    console.warn("getRecommendations error:", err);
    return [];
  }
}