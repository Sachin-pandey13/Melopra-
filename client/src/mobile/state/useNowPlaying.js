import { useSyncExternalStore } from "react";
import { searchYouTube } from "../utils/searchYouTube";

/* ---------- CONSTANTS ---------- */
const HISTORY_KEY = "melopra_recent_played";
const CACHE_KEY = "melopra_cached_songs";

/* ---------- HISTORY HELPERS ---------- */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function addToHistory(item, history) {
  if (!item) return history;
  const filtered = history.filter((h) => h.id !== item.id);
  return [item, ...filtered].slice(0, 30);
}

/* ---------- CACHE HELPERS (OFFLINE ONLY) ---------- */
function loadCacheSongs() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
  } catch {
    return [];
  }
}

/* ---------- STORE STATE ---------- */
let state = {
  current: null,

  // 🎯 main queue (manual + play next + autoplay)
  queue: [],

  // used for "previous" + repeat all fallback
  history: loadHistory(),

  isPlaying: false,

  repeatMode: "off", // off | one | all
  repeatOnce: false,

  isExpanded: false,
  backdropColor: null,

  // similarity logic
  isSmartLoading: false,

  // queue source tracking
  queueSource: "manual", // manual | ml | yt | cache
};

const listeners = new Set();

/* ---------- CORE ---------- */
function emit() {
  listeners.forEach((l) => l());
}

function setState(partial) {
  const next = { ...state, ...partial };
  state = next;

  if (partial.history) {
    saveHistory(next.history);
  }

  emit();
}

/* ---------- UTILS ---------- */
export function normalizeId(itemOrId) {
  if (!itemOrId) return null;

  const id = typeof itemOrId === "string" ? itemOrId : itemOrId.id || "";

  if (typeof id === "string" && id.startsWith("yt-")) return id.replace("yt-", "");
  if (typeof id === "string" && id.startsWith("firestore-"))
    return id.replace("firestore-", "");

  return id;
}

function isOffline() {
  return !navigator.onLine;
}

function uniqueQueue(items = []) {
  const seen = new Set();
  const result = [];

  for (const it of items) {
    const nid = normalizeId(it);
    if (!nid) continue;
    if (seen.has(nid)) continue;

    seen.add(nid);
    result.push(it);
  }

  return result;
}

/* ---------- PLAYBACK ACTIONS ---------- */
export function playItem(item, options = {}) {
  if (!item) return;

  const { keepQueue = false } = options;

  const newHistory = addToHistory(item, state.history);

  setState({
    current: item,
    history: newHistory,

    // 🚫 DO NOT wipe queue unless explicitly asked
    ...(keepQueue ? {} : { queue: [], queueSource: "manual" }),

    isPlaying: true,
    isExpanded: false,
  });
}

export function togglePlay() {
  if (!state.current) return;
  setState({ isPlaying: !state.isPlaying });
}

export function setPlayingState(value) {
  setState({ isPlaying: value });
}

/* ---------- QUEUE MANAGEMENT ---------- */
export function replaceQueue(items = [], source = "manual") {
  if (!Array.isArray(items)) return;

  // 🚫 BLOCK cache injection while online
  if (source === "cache" && !isOffline()) {
    console.warn("🚫 Blocked cache replaceQueue (online mode)");
    return;
  }

  setState({
    queue: uniqueQueue(items),
    queueSource: source,
  });
}

export function clearQueue() {
  setState({ queue: [], queueSource: "manual" });
}

export function enqueue(item, source = "manual") {
  if (!item) return;

  // 🚫 BLOCK cache injection while online
  if (source === "cache" && !isOffline()) {
    console.warn("🚫 Blocked cache enqueue (online mode)");
    return;
  }

  setState({
    queue: uniqueQueue([...state.queue, item]),
    queueSource: source,
  });
}

export function enqueueMany(items = [], source = "manual") {
  if (!Array.isArray(items) || items.length === 0) return;

  // 🚫 BLOCK cache injection while online
  if (source === "cache" && !isOffline()) {
    console.warn("🚫 Blocked cache enqueueMany (online mode)");
    return;
  }

  setState({
    queue: uniqueQueue([...state.queue, ...items]),
    queueSource: source,
  });
}

/* ---------- NEXT (FIXED + OFFLINE SAFE) ---------- */
export function playNext() {
  // 🔂 repeat ONE
  if (state.repeatMode === "one" && state.current) {
    setState({
      current: { ...state.current },
      isPlaying: true,

      ...(state.repeatOnce
        ? { repeatMode: "off", repeatOnce: false }
        : {}),
    });
    return;
  }

  // ▶️ queue always wins (manual / ML / autoplay)
  if (state.queue.length > 0) {
    const [next, ...rest] = state.queue;

    setState({
      history: state.current
        ? addToHistory(state.current, state.history)
        : state.history,

      current: next,
      queue: rest,
      isPlaying: true,
    });

    return;
  }

  // 🔁 repeat ALL uses history loop
  if (state.repeatMode === "all" && state.history.length > 0) {
    const replay = [...state.history].reverse();
    const [first, ...rest] = replay;

    setState({
      current: first,
      queue: rest,
      history: [],
      isPlaying: true,
      queueSource: "manual",
    });

    return;
  }

  // 📴 OFFLINE fallback ONLY (cached songs)
  if (isOffline()) {
    const cached = loadCacheSongs();

    const filtered = cached.filter((s) => {
      if (!s?.id) return false;
      if (state.current?.id && normalizeId(s) === normalizeId(state.current))
        return false;
      return true;
    });

    if (filtered.length > 0) {
      const [first, ...rest] = filtered;

      console.warn("📴 OFFLINE MODE: Using cached songs for next playback");

      setState({
        current: first,
        queue: rest.slice(0, 10),
        isPlaying: true,
        queueSource: "cache",
      });

      return;
    }
  }

  // ⏹ empty queue -> 🚀 SMART FETCH (Similarity Engine)
  if (!isOffline() && state.current) {
    fetchSimilarityNext(state.current);
    return;
  }

  // ⏹ nothing left
  setState({ isPlaying: false });
}

/* ---------- SIMILARITY ENGINE ---------- */
async function fetchSimilarityNext(currentTrack) {
  if (state.isSmartLoading) return;
  
  setState({ isSmartLoading: true });
  
  try {
     const artist = currentTrack.artist || "";
     const title = currentTrack.title || "";
     
     // Detect genre/context from title/artist
     let genreHint = "";
     if (/punjabi|sidhu|aujla|shubh/i.test(`${artist} ${title}`)) genreHint = "punjabi";
     else if (/hindi|arijit|shreya|romantic/i.test(`${artist} ${title}`)) genreHint = "hindi";
     else genreHint = "latest hits";

     // Heuristic: Search for "songs like [Title] by [Artist]" or "[Genre] songs like [Artist]"
     const query = `${genreHint} official music videos similar to ${artist} ${title}`;
     
     console.log(`🧠 Smart Play Next: Fetching similarity for "${title}" [${genreHint}]`);
     
     const results = await searchYouTube(query, 6);
     
     // Artist Diversity Filter: Remove current artist if possible, and keep original results
     const filtered = results.filter(s => 
       s.artist.toLowerCase() !== artist.toLowerCase()
     );
     
     const finalNext = filtered.length > 0 ? filtered : results;

     if (finalNext.length > 0) {
        const [next, ...rest] = finalNext;
        setState({
           current: next,
           queue: rest,
           isPlaying: true,
           queueSource: "ml",
           isSmartLoading: false
        });
     } else {
        setState({ isPlaying: false, isSmartLoading: false });
     }
  } catch (e) {
     console.error("Smart fetch failed", e);
     setState({ isPlaying: false, isSmartLoading: false });
  }
}

/* ---------- PREVIOUS ---------- */
export function playPrevious() {
  if (!state.history.length) return;

  const [prev, ...rest] = state.history;

  setState({
    current: prev,
    history: rest,
    isPlaying: true,
  });
}

/* ---------- REPEAT TOGGLE (3 MODES) ---------- */
export function toggleRepeat() {
  if (state.repeatMode === "off") {
    setState({ repeatMode: "one", repeatOnce: true });
    return;
  }

  if (state.repeatMode === "one" && state.repeatOnce) {
    setState({ repeatMode: "one", repeatOnce: false });
    return;
  }

  if (state.repeatMode === "one" && !state.repeatOnce) {
    setState({ repeatMode: "all", repeatOnce: false });
    return;
  }

  setState({ repeatMode: "off", repeatOnce: false });
}

/* ---------- QUEUE PLAY ---------- */
export function playFromQueue(index) {
  if (index < 0 || index >= state.queue.length) return;

  const next = state.queue[index];
  const rest = state.queue.filter((_, i) => i !== index);

  setState({
    history: state.current
      ? addToHistory(state.current, state.history)
      : state.history,
    current: next,
    queue: rest,
    isPlaying: true,
  });
}

export function moveQueueItemToNext(index) {
  if (index < 0 || index >= state.queue.length) return;

  const item = state.queue[index];
  const rest = state.queue.filter((_, i) => i !== index);

  setState({ queue: [item, ...rest] });
}

export function reorderQueue(from, to) {
  if (
    from < 0 ||
    to < 0 ||
    from >= state.queue.length ||
    to >= state.queue.length
  )
    return;

  const updated = [...state.queue];
  const [moved] = updated.splice(from, 1);
  updated.splice(to, 0, moved);

  setState({ queue: updated });
}

export function removeFromQueue(index) {
  if (index < 0 || index >= state.queue.length) return;

  setState({
    queue: state.queue.filter((_, i) => i !== index),
  });
}

export function shuffleQueue() {
  const shuffled = [...state.queue];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  setState({ queue: shuffled });
}

/* ---------- UI ---------- */
export function openPlayer() {
  if (!state.current) return;
  setState({ isExpanded: true });
}

export function closePlayer() {
  setState({ isExpanded: false });
}

export function setBackdropColor(color) {
  setState({ backdropColor: color });
}

/* ---------- STORE API ---------- */
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useNowPlaying() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
