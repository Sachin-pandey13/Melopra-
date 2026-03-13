/* -----------------------------------------
   MELoPRA LISTENING MEMORY ENGINE
   Learns user patterns over time.
------------------------------------------*/
const KEY = "melopra_memory_v2";
const BLACKLIST_KEY = "melopra_blacklist_v1";

export function learnPlay(song) {
  const db = JSON.parse(localStorage.getItem(KEY) || "{}");
  const artist = (song.artist || "unknown").toLowerCase();
  const now = Date.now();

  db[artist] = db[artist] || { score: 0, lastPlayed: now };
  db[artist].score++;
  db[artist].lastPlayed = now;

  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

/* ❌ Downvote interest - user isn't into it */
export function downvoteArtist(artist) {
  const db = JSON.parse(localStorage.getItem(KEY) || "{}");
  const key = artist.toLowerCase();
  if (db[key]) db[key].score = Math.max(0, db[key].score - 2);
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* 🚫 Hard block - never show it again */
export function blacklistArtist(artist) {
  const list = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || "[]");
  const key = artist.toLowerCase();
  if (!list.includes(key)) list.push(key);
  localStorage.setItem(BLACKLIST_KEY, JSON.stringify(list));
}

/* ⚖️ Decay old plays so trends shift naturally */
export function applyDecay(days = 7) {
  const db = JSON.parse(localStorage.getItem(KEY) || "{}");
  const now = Date.now();
  const decayMs = days * 86400000;

  for (const artist in db) {
    if (now - db[artist].lastPlayed > decayMs) {
      db[artist].score = Math.max(0, db[artist].score - 1); // soft decay
    }
  }
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* 🧠 Ranked interest list */
export function getTopInterests(limit = 5) {
  const db = JSON.parse(localStorage.getItem(KEY) || "{}");
  const blacklist = JSON.parse(localStorage.getItem(BLACKLIST_KEY) || "[]");

  return Object.entries(db)
    .filter(([artist]) => !blacklist.includes(artist.toLowerCase())) // skip blocked
    .sort((a,b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([artist, data]) => ({ artist, score: data.score }));
}
