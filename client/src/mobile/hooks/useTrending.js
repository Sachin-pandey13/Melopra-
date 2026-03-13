import { useEffect, useState } from "react";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// aggressive junk filter
const isValidMusicVideo = (title = "", channel = "") => {
  const t = title.toLowerCase();
  const c = channel.toLowerCase();

  // hard spam only
  const spam = [
    "playlist",
    "compilation",
    "best of",
    "top 10",
    "top 20",
    "mix",
    "hour",
  ];

  if (spam.some(w => t.includes(w))) return false;

  // allow common music terms
  return (
    c.includes("vevo") ||
    c.includes("topic") ||
    c.includes("records") ||
    c.includes("music") ||
    c.includes("official")
  );
};


// clean title
const cleanTitle = (title = "") => {
  return title
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/official|video|audio|song|music/gi, "")
    .replace(/\|.*/g, "")
    .trim()
    .slice(0, 32);
};

export default function useTrending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        // STEP 1: get popular music videos
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&maxResults=20&regionCode=IN&key=${YOUTUBE_API_KEY}`
        );

        const data = await res.json();

        const curated =
          (data.items || [])
            .filter(v =>
              isValidMusicVideo(
                v.snippet.title,
                v.snippet.channelTitle
              )
            )
            .slice(0, 10)
            .map(v => ({
              id: `yt-${v.id}`,
              title: cleanTitle(v.snippet.title),
              artist: v.snippet.channelTitle.replace(" - Topic", ""),
              image: v.snippet.thumbnails?.medium?.url,
              audio: `https://www.youtube.com/watch?v=${v.id}`,
              category: "YouTube",
            }));

        setItems(curated);
      } catch (e) {
        console.warn("Trending fetch failed", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return { items, loading };
}
