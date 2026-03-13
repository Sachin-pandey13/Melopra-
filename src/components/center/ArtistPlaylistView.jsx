import React, { useState } from "react";

export default function ArtistPlaylistView({
  artistData,
  onClose,
  onPlaySong,
  onQueueAll,
  onAddToPlaylist,
  onLike,
}) {
  if (!artistData) return null;

  const { artist, cover, songs = [] } = artistData;
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState({}); // avoid re-fetching same search

  const handleSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    if (cache[q]) {
      setSearchResults(cache[q]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          `${artist} ${q} song`
        )}&type=video&maxResults=10&key=${import.meta.env.VITE_YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      const mapped =
        data.items?.map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          image: item.snippet.thumbnails?.medium?.url,
          artist: item.snippet.channelTitle,
          audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          category: "YouTube",
        })) || [];

      setCache((prev) => ({ ...prev, [q]: mapped }));
      setSearchResults(mapped);
    } finally {
      setLoading(false);
    }
  };

  const list = query.trim() ? searchResults : songs;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-40 flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-neutral-900/80 border border-white/10 text-white w-full max-w-4xl rounded-2xl p-6 overflow-y-auto max-h-[90vh] space-y-6 shadow-2xl animate-slideUp">

        {/* HEADER */}
        <button
          onClick={onClose}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Back
        </button>

        <div className="flex gap-6 items-center">
          <img
            src={cover}
            alt={artist}
            className="w-48 h-48 rounded-xl object-cover shadow-lg"
          />

          <div className="space-y-2">
            <h2 className="text-4xl font-bold">{artist}</h2>
            <p className="text-white/60 text-sm">
              {songs.length} tracks available
            </p>

            {/* Controls */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => onPlaySong?.(songs[0])}
                className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition"
              >
                ▶ Play
              </button>

              <button
                onClick={() => {
                  const r = songs[Math.floor(Math.random() * songs.length)];
                  onPlaySong?.(r);
                }}
                className="px-4 py-2 bg-neutral-700 rounded-lg hover:bg-neutral-600 transition"
              >
                🔀 Shuffle
              </button>

              <button
                onClick={() => onQueueAll?.(songs)}
                className="px-4 py-2 bg-neutral-700 rounded-lg hover:bg-neutral-600 transition"
              >
                ➕ Queue All
              </button>
            </div>
          </div>
        </div>

        {/* 🔍 Search */}
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={`Search ${artist}...`}
          className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 ring-purple-600"
        />

        {loading && <div className="text-center py-4 opacity-60">Searching...</div>}

{/* SONG LIST */}
<div className="space-y-2 mt-4">
  {list.map((song, i) => (
    <div
      key={song.id || i}
      className="group flex items-center gap-3 p-3 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur cursor-pointer border border-transparent hover:border-white/10 transition"
      onClick={() => onPlaySong?.(song)}   // <-- Play when row clicked
    >
      <img
        src={song.image}
        className="w-14 h-14 rounded-md object-cover"
        alt={song.title}
      />

      <div className="flex-1">
        <div className="font-medium truncate group-hover:text-purple-400 transition">
          {song.title}
        </div>
        <div className="text-xs opacity-60 truncate">
          {song.artist || artist}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
        <button onClick={(e) => { e.stopPropagation(); onPlaySong?.(song); }}>▶</button>
        <button onClick={(e) => { e.stopPropagation(); onLike?.(song); }}>❤️</button>
        <button onClick={(e) => { e.stopPropagation(); onQueueAll?.([song]); }}>➕</button>
        <button onClick={(e) => { e.stopPropagation(); onAddToPlaylist?.(song); }}>📁</button>
      </div>
    </div>
  ))}
</div>

      </div>
    </div>
  );
}
