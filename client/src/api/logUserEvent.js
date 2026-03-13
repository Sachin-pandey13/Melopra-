// client/src/api/logUserEvent.js

export async function logUserEvent({
  userId,
  songId,
  event,
  playDuration = 0,
  songDuration = 0,
}) {
  if (!songId || !event) return;

  try {
    await fetch("http://localhost:4000/api/log_event", {
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
