const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

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

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&videoCategoryId=10` +
    `&maxResults=5&q=${encodeURIComponent(query)}` +   // ← was 15, now 5
    `&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.items) return [];

  const filtered = data.items
    .map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      image: item.snippet.thumbnails.medium.url,
      category: "YouTube",
    }))
    .filter((item) => isClean(item.title, item.artist))
    .sort((a, b) => scoreResult(b.title, b.artist) - scoreResult(a.title, a.artist))
    .slice(0, 3);

  setCache(cacheKey, filtered);
  return filtered;
}
