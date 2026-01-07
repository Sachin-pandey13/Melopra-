import React, { useEffect, useState } from "react";
import SmallSongCard from "./SmallSongCard";

export default function PodcastSection({ yt, onPlay }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let mounted = true;
    (async ()=>{
      try {
        const res = await yt.fetchYT("search", {
          part: "snippet",
          q: "podcast",
          type: "video",
          order: "viewCount",
          maxResults: 12
        });
        if (!mounted) return;
        const list = (res.items || []).map(it=>({
          id: it.id.videoId,
          title: it.snippet.title,
          artist: it.snippet.channelTitle,
          image: it.snippet.thumbnails.high?.url,
          source: "youtube"
        }));
        setItems(list);
      } catch(e){ console.warn(e) }
    })();
    return () => mounted=false;
  }, [yt]);

  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold">Podcasts</h3>
      <div className="flex gap-4 overflow-x-auto hide-scrollbar py-2">
        {items.map(i=> <SmallSongCard key={i.id} song={i} onClick={onPlay} />)}
      </div>
    </section>
  );
}
