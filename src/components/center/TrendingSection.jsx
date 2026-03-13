import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import SmallSongCard from "./SmallSongCard";

export default function TrendingSection({ onPlay, yt, selectedLanguages = ["English"] }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔍 Language → Region mapping for Spotify API
  const getRegionFromLanguage = (lang) => {
    switch (lang) {
      case "Hindi":
      case "Punjabi":
      case "Tamil":
      case "Telugu":
        return "IN";
      case "Korean":
        return "KR";
      case "Spanish":
        return "ES";
      case "French":
        return "FR";
      case "Japanese":
        return "JP";
      case "Arabic":
        return "SA";
      default:
        return "US";
    }
  };

  useEffect(() => {
    let active = true;
    const mainLanguage = selectedLanguages[0] || "English";
    const region = getRegionFromLanguage(mainLanguage);

    async function loadTrending() {
      setLoading(true);

      try {
        // 🔥 Try fetching from your Cloudflare Worker (Spotify Trending API)
        const res = await fetch(
          `https://deezer-proxy.sachinkumara1me.workers.dev/?region=${region}`
        );

        if (!res.ok) throw new Error("Spotify trending fetch failed");
        const data = await res.json();

        if (!active || !data.songs?.length) throw new Error("Empty Spotify data");

        const items = data.songs.map((s, index) => ({
          id: `${s.title}-${index}`,
          title: s.title,
          artist: s.artist,
          image: s.image,
          source: "spotify",
        }));

        setTracks(items);
      } catch (spotifyErr) {
        console.warn("Spotify API failed, switching to YouTube fallback →", spotifyErr);

        // 🧩 Fallback → YouTube trending music search
        try {
          const query = selectedLanguages
            .map((lang) => {
              switch (lang) {
                case "Hindi":
                  return "Bollywood trending songs 2025";
                case "Punjabi":
                  return "Punjabi trending songs 2025";
                case "Tamil":
                  return "Tamil trending songs 2025";
                case "Telugu":
                  return "Telugu trending songs 2025";
                case "Korean":
                  return "Kpop trending songs 2025";
                case "Spanish":
                  return "Latin pop trending songs";
                case "French":
                  return "French pop hits";
                case "Japanese":
                  return "Jpop trending songs 2025";
                case "Arabic":
                  return "Arabic trending songs";
                default:
                  return "English trending pop songs 2025";
              }
            })
            .join(" OR ");

          const res = await yt.fetchYT("search", {
            part: "snippet",
            type: "video",
            maxResults: 25,
            q: query,
            videoCategoryId: "10",
          });

          if (!active) return;

          const filtered = (res.items || []).filter((it) => {
            const title = it.snippet.title.toLowerCase();
            const channel = it.snippet.channelTitle.toLowerCase();
            const desc = it.snippet.description?.toLowerCase() || "";

            // 🚫 Remove trailers, vlogs, or irrelevant junk
            return (
              !title.includes("trailer") &&
              !title.includes("highlights") &&
              !title.includes("match") &&
              !title.includes("live") &&
              !title.includes("interview") &&
              !title.includes("teaser") &&
              !title.includes("shorts") &&
              !title.includes("reaction") &&
              !title.includes("episode") &&
              !title.includes("promo") &&
              !title.includes("review") &&
              !title.includes("vlog") &&
              !desc.includes("match") &&
              !desc.includes("trailer") &&
              !desc.includes("cricket") &&
              !channel.includes("studio") &&
              !channel.includes("trailer") &&
              !channel.includes("official trailer") &&
              !channel.includes("zee studios") &&
              !channel.includes("netflix") &&
              !channel.includes("prime video") &&
              !channel.includes("cricket") &&
              !channel.includes("news")
            );
          });

          const items = filtered.map((it) => ({
            id: it.id.videoId,
            title: it.snippet.title,
            artist: it.snippet.channelTitle,
            image:
              it.snippet.thumbnails.high?.url ||
              it.snippet.thumbnails.medium?.url ||
              it.snippet.thumbnails.default?.url,
            source: "youtube",
          }));

          setTracks(items);
        } catch (ytErr) {
          console.error("YouTube fallback also failed:", ytErr);
          setTracks([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTrending();
    return () => {
      active = false;
    };
  }, [yt, selectedLanguages]);

  if (loading)
    return (
      <section className="text-center py-6 text-gray-400">
        Loading trending songs...
      </section>
    );

  if (!tracks.length)
    return (
      <section className="text-center py-6 text-gray-400">
        No trending songs found.
      </section>
    );

  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold text-white">🔥 Trending Songs</h3>
      <Swiper spaceBetween={12} slidesPerView={"auto"}>
        {tracks.map((t) => (
          <SwiperSlide style={{ width: 160 }} key={t.id}>
            <SmallSongCard song={t} onClick={onPlay} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
