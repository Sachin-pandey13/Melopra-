import React, { useEffect, useState } from "react";
import ArtistPlaylistView from "./ArtistPlaylistView";

const DECAY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// In-memory session cache
const flowcastCache = new Map();

// Persistent cache (localStorage)
const loadLocalCache = () => {
  try {
    const data = JSON.parse(localStorage.getItem("flowcastCache") || "{}");
    Object.entries(data).forEach(([key, val]) => flowcastCache.set(key, val));
  } catch {}
};
const saveLocalCache = () => {
  const obj = Object.fromEntries(flowcastCache.entries());
  localStorage.setItem("flowcastCache", JSON.stringify(obj));
};

loadLocalCache();

export default function FlowCastSection({
  userDoc,
  recentPlayed = [],
  onOpenArtist,
  onQueueAll,        // <-- NEW
  onPlaySong,        // <-- NEW
  onAddToPlaylist,   // <-- NEW
  onLikeSong         // <-- NEW
}) {

  const [artists, setArtists] = useState([]);
const [selectedArtist, setSelectedArtist] = useState(null);

  useEffect(() => {
    let alive = true;

    // ---------- 1. SCORE ARTISTS ----------
    const now = Date.now();
    const scoreMap = new Map();

    if (recentPlayed?.length > 0) {
      recentPlayed.forEach((song, idx) => {
        if (!song?.artist) return;
        const age = now - (song.playedAt || now);
        const decay = Math.max(0.25, 1 - age / DECAY_MS);
        const recencyBoost = 1 + (recentPlayed.length - idx) * 0.05;
        scoreMap.set(song.artist, (scoreMap.get(song.artist) || 0) + decay * recencyBoost);
      });
    }

    if (scoreMap.size === 0 && userDoc?.favoriteArtists?.length) {
      userDoc.favoriteArtists.forEach((a, i) => scoreMap.set(a, 1 - i * 0.1));
    }

    if (scoreMap.size === 0) {
      setArtists([]);
      return;
    }

    const rankedArtists = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6) 
      .map(([artist]) => artist);

    // ---------- 2. FETCH ARTIST DATA + CACHE ----------
    (async () => {
      const result = [];
      const uniqueChannels = new Set();

      for (const item of recentPlayed) {
  const rawUrl = item.audio || "";
  let channelId = item.channelId || item.artistChannelId;

  // Try to safely extract ?v=ID from YouTube watch links
  try {
    const url = new URL(rawUrl);
    const vid = url.searchParams.get("v");
    if (!String(channelId).startsWith("UC")) continue;
  } catch {
    // ignore bad URLs (shorts, playlists, invalid links)
  }

  // ignore invalid / short / broken IDs
  if (!channelId || channelId.length < 10) continue;

        // avoid duplicates
        if (uniqueChannels.has(channelId)) continue;
        uniqueChannels.add(channelId);

        // 🛑 skip API if cached (session or localStorage)
        if (flowcastCache.has(channelId)) {
          result.push(flowcastCache.get(channelId));
          continue;
        }

        const res = await fetch(`http://localhost:4000/api/flowcast?channelId=${channelId}&sort=views`);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data.songs?.length) continue;

        const payload = {
          channelId,
          artist: data.channelName,
          cover: data.cover,
          songs: data.songs.slice(0, 10),
          reason: `Because you listen to ${data.channelName}`,
        };

        flowcastCache.set(channelId, payload);
        result.push(payload);
      }

      saveLocalCache(); // persist cache across sessions
      if (alive) setArtists(result);
    })();

    return () => (alive = false);
  }, [userDoc?.favoriteArtists?.join("|"), recentPlayed.map(s => s.id).join("|")]);

  if (!artists.length) return null;

  // ---------- 3. RENDER ----------
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold">FlowCast</h3>

      <div
  className="flex gap-6 overflow-x-auto no-scrollbar py-2 snap-x snap-mandatory"
  style={{
    scrollbarWidth: "none",          // Firefox
    msOverflowStyle: "none",          // IE/Edge
  }}
>

        {artists.map((a, i) => (
          <div
            key={`${a.channelId}-${i}`} // unique key fix
            className="w-56 flex-shrink-0 cursor-pointer"
           onClick={() => {
  setSelectedArtist(a); // opens playlist
}}
          >
            <div className="h-40 rounded-xl overflow-hidden">
              <img
                src={a.cover}
                alt={a.artist}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="mt-2 font-semibold truncate">{a.artist}</div>
            <div className="text-xs text-white/60">{a.reason}</div>
          </div>
        ))}
      </div>
{/* 🚀 Single FlowCast playlist modal */}
{selectedArtist && (
  <ArtistPlaylistView
    artistData={selectedArtist}
    onClose={() => setSelectedArtist(null)}

    // PLAY
    onPlaySong={(song) => onPlaySong?.(song)}

    // QUEUE ALL
    onQueueAll={(songs) => onQueueAll?.(songs)}

    // ADD TO PLAYLIST
    onAddToPlaylist={(song) => onAddToPlaylist?.(song)}

    // LIKE
    onLike={(song) => onLikeSong?.(song)}
  />
)}




    </section>
  );
}
