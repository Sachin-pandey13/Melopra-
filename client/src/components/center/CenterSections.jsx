import React, { useEffect, useState, useRef } from "react";
import HorizontalScroll from "./HorizontalScroll";
import FlowCastSection from "./FlowCastSection.jsx";
import { logAPI } from "../../utils/apiLogger";

// ── Tiny localStorage cache helpers (30-min TTL) ─────────────────────────────
const LS_TTL = 30 * 60 * 1000;

function lsRead(key) {
  try {
    const item = JSON.parse(localStorage.getItem(key));
    if (item && Date.now() - item.ts < LS_TTL) return item.data;
  } catch {}
  return null;
}

function lsWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ── Dedup helpers ─────────────────────────────────────────────────────────────
const dedupeById = (items = []) => {
  const map = new Map();
  items.forEach((item) => { if (!map.has(item.id)) map.set(item.id, item); });
  return Array.from(map.values());
};

const withScopedId = (items = [], scope) =>
  items.map((item) => ({ ...item, _scopedId: `${scope}-${item.id}` }));

const CenterSections = ({
  apiKey,
  yt,
  currentUser,
  userDoc,
  recentPlayed,
  onPlay,
  onAddToPlaylist,
  onLikeSong,
  onQueueAll,
  onOpenArtist,
}) => {
  const [trending, setTrending]     = useState(() => lsRead("cs_trending")    || []);
  const [podcasts, setPodcasts]     = useState(() => lsRead("cs_podcasts")    || []);
  const [interests, setInterests]   = useState([]);
  const [audiusSongs, setAudiusSongs] = useState([]);

  // ── TRENDING — cached 30 min ───────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return;

    // Already have fresh cached data — skip network call
    if (lsRead("cs_trending")?.length) return;

    const languageToRegions = {
      hindi: ["IN"], punjabi: ["IN"], english: ["US", "GB"],
      spanish: ["ES", "MX"], tamil: ["IN"], telugu: ["IN"], korean: ["KR"],
    };

    const userLangs = (userDoc?.selectedLanguages || []).map((l) => l.toString().toLowerCase());
    const langsToQuery = userLangs.length ? userLangs : ["english"];
    const favoriteArtists = (userDoc?.favoriteArtists || []).map((a) => a.toLowerCase());

    let cancelled = false;

    const fetchForRegion = async (regionCode) => {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=15&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Trending fetch failed: ${res.status}`);
      return res.json();
    };

    const loadTrending = async () => {
      try {
        const fetchPromises = [];
        for (const lang of langsToQuery) {
          const regions = languageToRegions[lang] || ["US"];
          for (const region of regions) {
            fetchPromises.push(
              fetchForRegion(region)
                .then((body) => {
                  const items = [];
                  if (body?.items) {
                    body.items.forEach((it) => {
                      const vid = it.id;
                      const snippet = it.snippet || {};
                      const stats   = it.statistics || {};
                      items.push({
                        id:        vid,
                        title:     snippet.title,
                        artist:    snippet.channelTitle,
                        image:     snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || "",
                        audio:     `https://www.youtube.com/watch?v=${vid}`,
                        category:  "YouTube",
                        viewCount: Number(stats.viewCount || 0),
                      });
                    });
                  }
                  return items;
                })
                .catch((e) => { console.warn("Region fetch failed:", region, e); return []; })
            );
          }
        }

        const resultsArray = await Promise.all(fetchPromises);
        if (cancelled) return;

        const byId = new Map();
        for (const item of resultsArray.flat()) {
          const existing = byId.get(item.id);
          if (!existing || item.viewCount > existing.viewCount) byId.set(item.id, item);
        }

        let merged = Array.from(byId.values()).sort((a, b) => b.viewCount - a.viewCount);

        if (favoriteArtists.length) {
          const favs = [], others = [];
          merged.forEach((m) => {
            const t = (m.title + " " + m.artist).toLowerCase();
            (favoriteArtists.some((f) => t.includes(f)) ? favs : others).push(m);
          });
          merged = [...favs, ...others];
        }

        const final = merged.slice(0, 20);
        lsWrite("cs_trending", final);
        setTrending(final);
      } catch (err) {
        console.warn("Trending section failed:", err);
      }
    };

    loadTrending();
    return () => { cancelled = true; };
  }, [apiKey, userDoc?.selectedLanguages?.join("|")]);

  // ── PODCASTS — cached 30 min, deferred 2 s ────────────────────────────────
  useEffect(() => {
    if (!apiKey) return;
    if (lsRead("cs_podcasts")?.length) return;  // serve from cache

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=top%20podcasts&type=video&maxResults=10&key=${apiKey}`
        );
        const data = await res.json();
        const mapped = (data.items || []).map((item) => ({
          id:       item.id.videoId,
          title:    item.snippet.title,
          artist:   item.snippet.channelTitle,
          image:    item.snippet.thumbnails.medium.url,
          audio:    `https://www.youtube.com/watch?v=${item.id.videoId}`,
          channelId: item.snippet.channelId,
          category: "YouTube",
        }));
        lsWrite("cs_podcasts", mapped);
        setPodcasts(mapped);
      } catch (e) {
        console.warn("Podcasts fetch failed", e);
      }
    }, 2000); // defer 2 s so trending loads first

    return () => clearTimeout(timer);
  }, [apiKey]);

  // ── YOUR INTERESTS — session cooldown + cache ─────────────────────────────
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

    if (!entries.length) { setInterests([]); return; }

    const fetchInterests = async () => {
      const cache = JSON.parse(localStorage.getItem("melopra_interest_cache") || "{}");

      const fetchPromises = entries.map(async ([artist]) => {
        const cleanArtist = artist.toLowerCase().trim();
        if (cache[cleanArtist]) return cache[cleanArtist];

        const query = `${cleanArtist} official audio`;
        logAPI("INTEREST_FETCH", query);

        try {
          const data = await yt.fetchYT("search", { part: "snippet", q: query, type: "video", maxResults: 5 });
          const songs = (data.items || []).map((item) => {
            const vid = item.id?.videoId || item.id;
            return {
              id:     vid,
              title:  item.snippet?.title || "Unknown Title",
              artist: item.snippet?.channelTitle || cleanArtist,
              image:  item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
              audio:  `https://www.youtube.com/watch?v=${vid}`,
              video:  `https://www.youtube.com/embed/${vid}?autoplay=1`,
              category:  "YouTube",
              channelId: item.snippet?.channelId || null,
            };
          });
          const resultObj = { artist: cleanArtist, songs };
          if (songs.length) cache[cleanArtist] = resultObj;
          return songs.length ? resultObj : null;
        } catch (err) {
          console.warn("Interest fetch failed", err);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      const grouped = results.filter(Boolean);
      localStorage.setItem("melopra_interest_cache", JSON.stringify(cache));
      setInterests(grouped);
    };

    fetchInterests();
  }, [apiKey, recentPlayed]);

  // ── AUDIUS — low priority, fire-and-forget ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch("https://discoveryprovider.audius.co/v1/tracks/trending?app_name=Melopra");
        const data = await res.json();
        setAudiusSongs(
          data.data?.slice(0, 10).map((track) => ({
            id:       track.id,
            title:    track.title,
            artist:   track.user.name,
            image:    track.artwork["150x150"] || track.artwork["480x480"] || "",
            audio:    track.stream_url,
            category: "Audius",
          })) || []
        );
      } catch (e) {
        console.warn("Audius fetch failed", e);
      }
    }, 4000); // lowest priority — 4 s delay

    return () => clearTimeout(timer);
  }, []);

  // ── Skeleton card for while trending loads ────────────────────────────────
  const SkeletonRow = () => (
    <div className="space-y-3">
      <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40 space-y-2 animate-pulse">
            <div className="w-40 h-40 bg-white/10 rounded-xl" />
            <div className="h-3 w-3/4 bg-white/10 rounded" />
            <div className="h-3 w-1/2 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">

      {/* 🔥 FlowCast */}
      <FlowCastSection
        userDoc={userDoc}
        recentPlayed={recentPlayed}
        onPlaySong={onPlay}
        onQueueAll={onQueueAll}
        onAddToPlaylist={onAddToPlaylist}
        onLikeSong={onLikeSong}
        onOpenArtist={onOpenArtist}
      />

      {/* Trending */}
      {trending.length > 0 ? (
        <HorizontalScroll
          title="Trending"
          items={withScopedId(dedupeById(trending), "trending")}
          onPlay={onPlay}
        />
      ) : (
        <SkeletonRow />
      )}

      {/* Your Interests */}
      {interests.length > 0 && (
        <HorizontalScroll
          title="Your Interest"
          items={withScopedId(dedupeById(interests.flatMap((g) => g.songs)), "interest")}
          onPlay={onPlay}
        />
      )}

      {/* Audius Picks */}
      {audiusSongs.length > 0 && (
        <HorizontalScroll
          title="Audius Picks"
          items={withScopedId(dedupeById(audiusSongs), "audius")}
          onPlay={onPlay}
        />
      )}

      {/* Podcasts */}
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
