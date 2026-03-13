import React, { useEffect, useState } from "react";
import SmallSongCard from "./SmallSongCard";
export default function AudiusSection({ onPlay }) {
  const [tracks, setTracks] = useState([]);
  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try {
        const res = await fetch('https://discoveryprovider.audius.co/v1/tracks/trending?limit=20');
        const json = await res.json();
        if (!mounted) return;
        setTracks((json || []).map(t=>({
          id: t.tracking_id || t.id,
          title: t.title,
          artist: t.user?.name || t.user?.handle,
          image: t.artwork?.small || t.artwork?.large || t.cover_art,
          source: 'audius',
          audio: t.stream_url || t.preview_url
        })));
      } catch(e){ console.warn(e) }
    })();
    return ()=> mounted=false;
  }, []);
  if (!tracks.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold">Audius</h3>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar py-2">
        {tracks.map(t => <SmallSongCard key={t.id} song={t} onClick={onPlay} />)}
      </div>
    </section>
  );
}
