// src/utils/audiusAPI.js
const API_BASE = import.meta.env.VITE_AUDIUS_API || "https://api.audius.co/v1";

export async function fetchTrendingTracks(limit = 12) {
  const res = await fetch(`${API_BASE}/tracks/trending?limit=${limit}`);
  const data = await res.json();
  return data?.data || [];
}

export async function searchAudiusTracks(query) {
  const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&type=tracks`);
  const data = await res.json();
  return data?.data?.tracks || [];
}
