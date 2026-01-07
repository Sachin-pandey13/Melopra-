// src/components/TrackSearch.jsx
import { useState } from "react";
import { searchTracks } from "../utils/spotifyAPI";

export default function TrackSearch({ onTrackSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const token = localStorage.getItem("spotify_access_token");

  const handleSearch = async () => {
    const data = await searchTracks(query, token);
    setResults(data.tracks.items);
  };

  return (
    <div className="p-4 text-white">
      <input
        className="bg-gray-800 p-2 rounded mr-2"
        placeholder="Search for tracks..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        className="bg-green-600 px-4 py-2 rounded"
        onClick={handleSearch}
      >
        Search
      </button>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {results.map((track) => (
          <div
            key={track.id}
            className="bg-gray-900 p-3 rounded cursor-pointer"
            onClick={() => onTrackSelect(track)}
          >
            <img
              src={track.album.images[0]?.url}
              alt={track.name}
              className="w-full h-32 object-cover rounded"
            />
            <div className="mt-2">{track.name}</div>
            <div className="text-sm text-gray-400">{track.artists[0].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
