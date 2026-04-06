const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:4000" : "https://melopra-production.up.railway.app");

// ─── LRU Cache (max 50 entries, 10‑min TTL) ───────────────────────────────
const CACHE_MAX = 50;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const searchCache = new Map(); // key → { results, ts }

function getCache(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { searchCache.delete(key); return null; }
  console.log("[YT Cache HIT]", key);
  return hit.results;
}

function setCache(key, results) {
  if (searchCache.size >= CACHE_MAX) {
    // evict oldest entry
    searchCache.delete(searchCache.keys().next().value);
  }
  searchCache.set(key, { results, ts: Date.now() });
}
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_KEYWORDS = [
  "shorts", "lofi", "slowed", "reverb", "remix", "cover",
  "live", "status", "reaction", "edit", "instrumental",
  "karaoke", "8d", "nightcore", "audio only",
];

function isClean(title = "", channel = "") {
  const t = title.toLowerCase();
  if (BLOCKED_KEYWORDS.some((k) => t.includes(k))) return false;
  if (
    t.includes("official") ||
    channel.toLowerCase().includes("topic") ||
    channel.toLowerCase().includes("records") ||
    channel.toLowerCase().includes("music")
  ) return true;
  return t.split(" ").length <= 10;
}

function scoreResult(title = "", channel = "") {
  const t = title.toLowerCase();
  const c = channel.toLowerCase();
  let score = 0;
  if (t.includes("official")) score += 5;
  if (c.includes("topic")) score += 4;
  if (c.includes("records")) score += 3;
  if (!t.includes("(") && !t.includes("[")) score += 2;
  return score;
}

export async function searchYouTube(query) {
  if (!query) return [];

  const cacheKey = query.toLowerCase().trim();
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `${SERVER_URL}/api/yt-search?q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url);
  const data = await res.json();

  if (!Array.isArray(data)) return [];

  const filtered = data
    .filter((item) => isClean(item.title, item.artist))
    .sort((a, b) => scoreResult(b.title, b.artist) - scoreResult(a.title, a.artist))
    .slice(0, 3);

  setCache(cacheKey, filtered);
  return filtered;
}

export async function getRelatedSongs(videoId) {
  if (!videoId) return [];
  try {
    const res = await fetch(`${SERVER_URL}/api/yt-related?id=${videoId}`);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((item) => isClean(item.title, item.artist))
      .slice(0, 10);
  } catch (err) {
    console.error("Failed to get related songs:", err);
    return [];
  }
}
