// client/src/api/logUserEvent.js
// ─────────────────────────────────────────────────────────────
// Enhanced event logger — sends richer metadata to the backend.
// The extra fields (songMeta, completionRate, sessionId) are used
// by MongoDB for building the user's personalized taste profile.
//
// BACKWARDS COMPATIBLE — all new fields are optional.
// If the backend is old, it simply ignores extra fields.
// ─────────────────────────────────────────────────────────────

// Stable session ID for this browser tab (survives page navigations)
const _sessionId = (() => {
  const key = "melopra_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
})();

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Log a user interaction event to the backend.
 *
 * @param {object} params
 * @param {string}      params.userId        Firebase UID (optional for anonymous)
 * @param {string}      params.songId        YouTube video ID or Firestore doc ID
 * @param {string}      params.event         "play" | "complete" | "skip" | "repeat" | "like"
 * @param {number}      params.playDuration  Seconds actually listened
 * @param {number}      params.songDuration  Total song length in seconds
 * @param {object}      params.songMeta      { title, artist, language, genre }
 */
export async function logUserEvent({
  userId       = "",
  songId,
  event,
  playDuration  = 0,
  songDuration  = 0,
  songMeta      = {},    // ← new: { title, artist, language, genre }
}) {
  if (!songId || !event) return;

  // Compute completion rate (clamped 0–1)
  const completionRate = songDuration > 0
    ? Math.min(1, Math.max(0, playDuration / songDuration))
    : 0;

  // Fire-and-forget — never await this in UI code
  try {
    fetch(`${BASE_URL}/api/log_event`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        songId,
        event,
        playDuration,
        songDuration,
        completionRate,
        sessionId: _sessionId,
        songMeta: {
          title:    songMeta.title    || "",
          artist:   songMeta.artist   || "",
          language: songMeta.language || songMeta.lang || "",
          genre:    songMeta.genre    || songMeta.category || "",
        },
      }),
      // keepalive: sends even if page closes (good for "skip" events)
      keepalive: true,
    }).catch(err => console.warn("⚠️ logUserEvent failed:", err.message));
  } catch (err) {
    // Completely silent — never crash the UI for analytics
  }
}
