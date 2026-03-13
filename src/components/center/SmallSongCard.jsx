import React from "react";

export default function SmallSongCard({ song, onClick }) {
  // song: { id, title, artist, image, source }
  return (
    <div
      className="w-40 flex-shrink-0 cursor-pointer group"
      onClick={() => onClick && onClick(song)}
      title={`${song.title} — ${song.artist}`}
    >
      <div className="w-40 h-40 rounded-xl overflow-hidden shadow-lg bg-zinc-900 relative">
        <img
          src={song.image}
          alt={song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="mt-2 text-sm">
        <div className="font-medium truncate">{song.title}</div>
        <div className="text-xs text-white/60 truncate">{song.artist}</div>
      </div>
    </div>
  );
}
