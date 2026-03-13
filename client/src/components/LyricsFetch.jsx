// client/src/components/LyricsFetch.jsx
import React, { useState } from "react";

export default function LyricsFetch() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [lyrics, setLyrics] = useState(null);

  async function fetchLyrics() {
    if (!q.trim()) return setStatus("Enter artist + title or song title");
    setStatus("Searching...");
    try {
      const res = await fetch(`http://localhost:4000/api/lyrics?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.found) {
        setLyrics(json);
        setStatus("Found lyrics");
      } else {
        setLyrics(null);
        setStatus("Not found");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error fetching lyrics");
    }
  }

  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-semibold">Fetch Lyrics</h3>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="artist - title or song name" className="border p-2 w-full" />
      <div className="flex gap-2 mt-2">
        <button onClick={fetchLyrics} className="px-3 py-1 bg-green-600 text-white rounded">Fetch</button>
      </div>
      <div className="mt-3 text-sm">{status}</div>
      {lyrics && (
        <div className="mt-3"><strong>{lyrics.title} — {lyrics.artist}</strong><pre className="whitespace-pre-wrap">{lyrics.lyrics}</pre></div>
      )}
    </div>
  );
}
