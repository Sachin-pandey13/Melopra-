// ===== SEED ARTIST GENRE MAP (anchors you can expand slowly) =====
export const ARTIST_GENRE_MAP = {
  "Karan Aujla": "Punjabi",
  "Divine": "Indian Hip-Hop",
  "AP Dhillon": "Punjabi Pop",
  "Arijit Singh": "Bollywood",
  "Badshah": "Indian Pop",
  "Yo Yo Honey Singh": "Desi Pop",
  "Lofi Girl": "Lofi",
  "JVKE": "Indie Pop",
  "The Weeknd": "R&B",
  "Drake": "Hip-Hop",
  "Taylor Swift": "Pop"
};

// ===== DYNAMIC LEARNING CACHE =====
const GENRE_CACHE_KEY = "melopra_dynamic_genres";
export function getDynamicMap() {
  return JSON.parse(localStorage.getItem(GENRE_CACHE_KEY) || "{}");
}
export function saveDynamicMap(map) {
  localStorage.setItem(GENRE_CACHE_KEY, JSON.stringify(map));
}

// ===== MAIN GENRE RESOLVER =====
export function resolveGenre(song = {}) {
  const artist = song.artist?.trim();
  const title = song.title?.toLowerCase() || "";
  const dynamic = getDynamicMap();

  // 1. Manual anchors
  if (artist && ARTIST_GENRE_MAP[artist]) return ARTIST_GENRE_MAP[artist];

  // 2. Keyword inference from title
  if (title.includes("lofi")) return "Lofi";
  if (title.includes("rap")) return "Hip-Hop";
  if (title.includes("remix")) return "Remix";
  if (title.includes("sad")) return "Sad Vibes";
  if (title.includes("official")) return "Mainstream";

  // 3. Learned mapping
  if (artist && dynamic[artist]) return dynamic[artist];

  // 4. Fallback
  return "Misc";
}

// ===== AUTO-LEARN ARTISTS =====
export function learnGenre(song, genre) {
  const artist = song.artist?.trim();
  if (!artist || !genre) return;
  const dynamic = getDynamicMap();
  dynamic[artist] = genre;
  saveDynamicMap(dynamic);
}

// ===== WEIGHT UPDATE SYSTEM =====
const weights = {
  play: 2,
  like: 4,
  replay: 3,
  skip: -2,
  dislike: -5
};

const INTEREST_KEY = "melopra_interests";

export function updateInterestWeights(song, action = "play") {
  const genre = resolveGenre(song);
  const data = JSON.parse(localStorage.getItem(INTEREST_KEY) || "{}");
  data[genre] = (data[genre] || 0) + (weights[action] || 0);
  localStorage.setItem(INTEREST_KEY, JSON.stringify(data));
  return { genre, score: data[genre] };
}

// ===== GET RANKED INTERESTS FOR FEED =====
export function getRankedInterests(limit = 3) {
  const data = JSON.parse(localStorage.getItem(INTEREST_KEY) || "{}");
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, score]) => ({ genre, score }));
}
