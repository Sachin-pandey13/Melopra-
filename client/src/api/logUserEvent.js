// client/src/api/logUserEvent.js

export async function logUserEvent({
  userId,
  songId,
  event,
  playDuration = 0,
  songDuration = 0,
}) {
  if (!songId || !event) return;

  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
  try {
    await fetch(`${BASE_URL}/api/log_event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        songId,
        event,
        playDuration,
        songDuration,
      }),
    });
  } catch (err) {
    console.warn("⚠️ logUserEvent failed:", err);
  }
}
