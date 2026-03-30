// client/src/api/getRecommendations.js

export async function getRecommendations(userId, seedSong = null) {
  if (!userId) return [];

  try {
    const BASE_URL =
      import.meta.env.VITE_API_URL || "http://localhost:4000";

    const seedTitle = seedSong?.title || "";
    const seedArtist = seedSong?.artist || "";
    const seedGenre = seedSong?.genre || "";
    const seedLang = seedSong?.lang || seedSong?.language || "";

    // 🔥 Normalize seedId (remove yt- / firestore- prefix)
    let seedId = seedSong?.id || "";
    if (seedId.startsWith("yt-")) seedId = seedId.replace("yt-", "");
    if (seedId.startsWith("firestore-"))
      seedId = seedId.replace("firestore-", "");

    const url =
      `${BASE_URL}/api/recommendations?` +
      `userId=${encodeURIComponent(userId)}` +
      `&seedTitle=${encodeURIComponent(seedTitle)}` +
      `&seedArtist=${encodeURIComponent(seedArtist)}` +
      `&seedGenre=${encodeURIComponent(seedGenre)}` +
      `&seedLang=${encodeURIComponent(seedLang)}` +
      `&seedId=${encodeURIComponent(seedId)}`;

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
  } catch (err) {
    console.warn("getRecommendations error:", err);
    return [];
  }
}