import React, { useEffect, useState } from "react";
import SmallSongCard from "./SmallSongCard";
import {
  getTopInterests,
  downvoteArtist,
  blacklistArtist
} from "../utils/listeningMemory";

export default function InterestSection({ onPlay }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔁 Build stable interest feed (logic unchanged)
  const loadInterests = async () => {
    setLoading(true);

    const ranked = getTopInterests(5); // top 5 interest groups max

    if (!ranked.length) {
      setBlocks([]);
      setLoading(false);
      return;
    }

    try {
      // 🔐 SINGLE backend call (no YouTube key on frontend)
      const res = await fetch("http://127.0.0.1:5001/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artists: ranked
        })
      });

      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch (err) {
      console.warn("⚠️ Interest fetch failed:", err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Load when app opens or listening history evolves
  useEffect(() => {
    loadInterests();
  }, []);

  // 💤 No data? Hide section
  if (!blocks.length && !loading) return null;

  return (
    <section className="space-y-6 animate-fadeIn">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Your Interests</h3>
        <button
          onClick={loadInterests}
          className="text-sm px-3 py-1 bg-neutral-800 rounded hover:bg-neutral-700 transition"
        >
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="opacity-60 text-sm">
          Learning from your listening...
        </div>
      )}

      {/* Artist Blocks */}
      {blocks.map((block) => (
        <div key={block.artist} className="space-y-2 animate-slideUp">

          {/* Title + Remove Option */}
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-medium text-white/80">
              Because you listen to{" "}
              <span className="text-white">{block.artist}</span>
            </h4>

            <button
              onClick={() => {
                blacklistArtist(block.artist);
                loadInterests();
              }}
              className="text-xs px-2 py-1 bg-black/40 rounded hover:bg-black/60"
            >
              🚫 Don’t show
            </button>
          </div>

          {/* Songs Row */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            {block.songs.map((song) => (
              <div key={song.id} className="relative group">
                <SmallSongCard
                  song={song}
                  onClick={() => onPlay?.(song)}
                />

                {/* 👎 Downvote */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downvoteArtist(song.artist);
                    loadInterests();
                  }}
                  className="absolute top-1 right-1 text-xs bg-black/60 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                >
                  👎
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
