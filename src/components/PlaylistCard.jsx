// src/components/PlaylistCard.jsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";

const PlaylistCard = ({ playlist, onClick }) => {
const { name: title, songs = [] } = playlist;
 const { currentUser } = useAuth();

  // Pull image from song fields if available
  const albumImages = songs
    .map((song) => song.image || song.thumbnail || song.cover || song.albumImage)
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 cursor-pointer transition w-48"
    >
      {/* Grid of 4 images */}
      <div className="grid grid-cols-2 grid-rows-2 w-full h-32">
        {albumImages.length > 0 ? (
          albumImages.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={`album-${index}`}
              className="object-cover w-full h-full"
            />
          ))
        ) : (
          <div className="col-span-2 row-span-2 flex items-center justify-center bg-gray-800 text-white text-sm">
            No Image
          </div>
        )}
      </div>

      {/* Playlist title and user name */}
      <div className="p-3 text-white">
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <p className="text-xs text-gray-400">{currentUser?.email?.split("@")[0] || "User"}</p>
      </div>
    </div>
  );
};

export default PlaylistCard;
