import React, { useEffect, useState, useRef } from "react";
import HorizontalScroll from "./HorizontalScroll";
import FlowCastSection from "./FlowCastSection.jsx";
import { logAPI } from "../../utils/apiLogger";

const CenterSections = ({
    apiKey,
  yt,
  currentUser,
  userDoc,
  recentPlayed,
  onPlay,            // play a song
  onAddToPlaylist,   // add to playlist
  onLikeSong,        // like/favorite
  onQueueAll,        // queue system
  onOpenArtist
}) => {

  const [trending, setTrending] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [interests, setInterests] = useState([]);
  const [audiusSongs, setAudiusSongs] = useState([]);

  const dedupeById = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
};

const withScopedId = (items = [], scope) =>
  items.map((item) => ({
    ...item,
    _scopedId: `${scope}-${item.id}`,
  }));

  // 🎵 TRENDING SECTION — based on selected languages + favorite artists
  useEffect(() => {
    if (!apiKey) return;

    const languageToRegions = {
      hindi: ["IN"],
      punjabi: ["IN"],
      english: ["US", "GB"],
      spanish: ["ES", "MX"],
      tamil: ["IN"],
      telugu: ["IN"],
      korean: ["KR"],
    };

    const userLangs = (userDoc?.selectedLanguages || []).map((l) =>
      l.toString().toLowerCase()
    );
    const langsToQuery = userLangs.length ? userLangs : ["english"];

    const favoriteArtists = (userDoc?.favoriteArtists || []).map((a) =>
      a.toLowerCase()
    );

    let cancelled = false;

    const fetchForRegion = async (regionCode) => {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=15&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Trending fetch failed: ${res.status}`);
      return res.json();
    };

    const loadTrending = async () => {
      try {
        const allItems = [];

        for (const lang of langsToQuery) {
          const regions = languageToRegions[lang] || ["US"];
          for (const region of regions) {
            try {
              const body = await fetchForRegion(region);
              if (body?.items) {
                body.items.forEach((it) => {
                  const vid = it.id;
                  const snippet = it.snippet || {};
                  const stats = it.statistics || {};
                  allItems.push({
                    id: vid,
                    title: snippet.title,
                    artist: snippet.channelTitle,
                    image:
                      snippet.thumbnails?.high?.url ||
                      snippet.thumbnails?.medium?.url ||
                      "",
                    audio: `https://www.youtube.com/watch?v=${vid}`,
                    category: "YouTube",
                    viewCount: Number(stats.viewCount || 0),
                  });
                });
              }
            } catch (e) {
              console.warn("Region fetch failed:", region, e);
            }
          }
        }

        if (cancelled) return;

        const byId = new Map();
        for (const item of allItems) {
          const existing = byId.get(item.id);
          if (!existing || item.viewCount > existing.viewCount)
            byId.set(item.id, item);
        }

        let merged = Array.from(byId.values()).sort(
          (a, b) => b.viewCount - a.viewCount
        );

        if (favoriteArtists.length) {
          const favs = [];
          const others = [];
          merged.forEach((m) => {
            const t = (m.title + " " + m.artist).toLowerCase();
            const isFav = favoriteArtists.some((f) => t.includes(f));
            (isFav ? favs : others).push(m);
          });
          merged = [...favs, ...others];
        }

        setTrending(merged.slice(0, 20));
      } catch (err) {
        console.warn("Trending section failed:", err);
      }
    };

    loadTrending();
    return () => {
      cancelled = true;
    };
  }, [apiKey, userDoc?.selectedLanguages?.join("|")]);
  // 🔥 Podcasts
  useEffect(() => {
    const fetchPodcasts = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=top%20podcasts&type=video&maxResults=10&key=${apiKey}`
        );
        const data = await res.json();
        setPodcasts(
          data.items?.map((item) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            image: item.snippet.thumbnails.medium.url,
            audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            channelId: item.snippet.channelId, 
            category: "YouTube",
          })) || []
        );
      } catch (e) {
        console.warn("Podcasts fetch failed", e);
      }
    };
    fetchPodcasts();
  }, [apiKey]);

// 🔥 Your Interests (Optimized)
const lastFetchRef = useRef(0);
const COOLDOWN = 15000; 

useEffect(() => {
  if (!apiKey) return;

  
if (Date.now() - lastFetchRef.current < COOLDOWN) return;
lastFetchRef.current = Date.now();


  
  const lc = JSON.parse(localStorage.getItem("melopra_listen_count") || "{}");
  const entries = Object.entries(lc)
    .filter(([_, count]) => count >= 2)     
    .sort((a, b) => b[1] - a[1])            
    .slice(0, 3);                           

  
  if (!entries.length) {
    setInterests([]);
    return;
  }

  const fetchInterests = async () => {
    const grouped = [];

    
    const cache = JSON.parse(localStorage.getItem("melopra_interest_cache") || "{}");

    for (const [artist] of entries) {
      const cleanArtist = artist.toLowerCase().trim();

    
      if (cache[cleanArtist]) {
        grouped.push(cache[cleanArtist]);
        continue;
      }

      const query = `${cleanArtist} official audio`;
      logAPI("INTEREST_FETCH", query); 

      
      const data = await yt.fetchYT("search", {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 5,
      });

      const songs = (data.items || []).map((item) => {
        const vid = item.id?.videoId || item.id;

        return {
          id: vid,
          title: item.snippet?.title || "Unknown Title",
          artist: item.snippet?.channelTitle || cleanArtist,
          image:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",

          audio: `https://www.youtube.com/watch?v=${vid}`,
          video: `https://www.youtube.com/embed/${vid}?autoplay=1`,

          category: "YouTube",
          channelId: item.snippet?.channelId || null,
        };
      });

      if (songs.length) grouped.push({ artist: cleanArtist, songs });

      
      cache[cleanArtist] = { artist: cleanArtist, songs };
      localStorage.setItem("melopra_interest_cache", JSON.stringify(cache));
    }

    setInterests(grouped);
  };

  fetchInterests();
}, [apiKey, recentPlayed]);



  // 🔥 Audius
  useEffect(() => {
    const fetchAudius = async () => {
      try {
        const res = await fetch(
          "https://discoveryprovider.audius.co/v1/tracks/trending?app_name=Melopra"
        );
        const data = await res.json();
        setAudiusSongs(
          data.data?.slice(0, 10).map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.user.name,
            image:
              track.artwork["150x150"] || track.artwork["480x480"] || "",
            audio: track.stream_url,
            category: "Audius",
          })) || []
        );
      } catch (e) {
        console.warn("Audius fetch failed", e);
      }
    };
    fetchAudius();
  }, []);

return (
  <div className="flex flex-col gap-8 p-4 md:p-8">

    {/* 🔥 FlowCast Section with correct handlers */}
<FlowCastSection
  userDoc={userDoc}
  recentPlayed={recentPlayed}

  // core controls
  onPlaySong={onPlay}
  onQueueAll={onQueueAll}
  onAddToPlaylist={onAddToPlaylist}
  onLikeSong={onLikeSong}

  // open artist view
  onOpenArtist={onOpenArtist}
/>


    {trending.length > 0 && (
  <HorizontalScroll
    title="Trending"
    items={withScopedId(dedupeById(trending), "trending")}
    onPlay={onPlay}
  />
)}

{interests.length > 0 && (
  <HorizontalScroll
    title="Your Interest"
    items={withScopedId(
      dedupeById(interests.flatMap((group) => group.songs)),
      "interest"
    )}
    onPlay={onPlay}
  />
)}



   {audiusSongs.length > 0 && (
  <HorizontalScroll
    title="Audius Picks"
    items={withScopedId(dedupeById(audiusSongs), "audius")}
    onPlay={onPlay}
  />
)}


    {podcasts.length > 0 && (
  <HorizontalScroll
    title="Podcasts"
    items={withScopedId(dedupeById(podcasts), "podcast")}
    onPlay={onPlay}
  />
)}

  </div>
);


};

export default CenterSections;
