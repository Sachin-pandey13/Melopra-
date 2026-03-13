const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

const BLOCKED_KEYWORDS = [
  "shorts",
  "lofi",
  "slowed",
  "reverb",
  "remix",
  "cover",
  "live",
  "status",
  "reaction",
  "edit",
  "instrumental",
  "karaoke",
  "8d",
  "nightcore",
  "audio only",
  "lyrics",
];

function isClean(title = "", channel = "") {
  const t = title.toLowerCase();
  const c = channel.toLowerCase();

  if (BLOCKED_KEYWORDS.some(k => t.includes(k))) return false;

  // allow official / topic / label channels
  if (
    t.includes("official") ||
    c.includes("topic") ||
    c.includes("records") ||
    c.includes("music")
  ) {
    return true;
  }

  // otherwise keep only very clean titles
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

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&videoCategoryId=10` +
    `&maxResults=15&q=${encodeURIComponent(query)}` +
    `&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.items) return [];

  const filtered = data.items
    .map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      image: item.snippet.thumbnails.medium.url,
      category: "YouTube",
    }))
    .filter(item => isClean(item.title, item.artist))
    .sort(
      (a, b) =>
        scoreResult(b.title, b.artist) -
        scoreResult(a.title, a.artist)
    )
    .slice(0, 3); // 🔥 ONLY 2–3 RESULTS

  return filtered;
}
