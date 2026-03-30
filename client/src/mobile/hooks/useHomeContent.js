import { useState, useEffect, useMemo } from "react";
import { searchYouTube } from "../utils/searchYouTube";
import { playItem, replaceQueue } from "../state/useNowPlaying";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// Browser ORB policy is strict on mobile; we must proxy dzcdn images through weserv
const proxy = (url) => {
  if (!url) return "";
  if (url.includes("wsrv.nl") || !url.includes("dzcdn.net")) return url;
  const cleanUrl = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${cleanUrl}&w=400&h=400&fit=cover`;
};

/**
 * Hook to manage complex home screen data needs:
 * - FlowCast (Personalized artist radio)
 * - Trending (YT + Deezer)
 * - New Releases (Followed artists)
 * - Smart Mixes (Mood/Genre based)
 */
export default function useHomeContent({ library, actions }) {
  const [trending, setTrending] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const followedArtists = library?.followedArtists || [];
  
  // 💡 High-quality mock artists for stable visuals
  const displayArtists = followedArtists.length > 0 
    ? followedArtists 
    : [
        { id: "m-1", name: "Arijit Singh", image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&w=400&q=80" },
        { id: "m-2", name: "Karan Aujla", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80" },
        { id: "m-3", name: "The Weeknd", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80" }
      ];

  // 1. FLOWCAST: "Because you listen to..."
  const flowCastData = useMemo(() => {
    return displayArtists.slice(0, 5).map(artist => ({
      id: `flowcast-${artist.id}`,
      title: `${artist.name} Mix`,
      subtitle: `Inspired by your love for ${artist.name}`,
      image: proxy(artist.image),
      type: "artist-mix",
      artist: artist.name,
      // used for actions
      onPlay: async () => {
         // Fetches the artist's top tracks gracefully instead of passing arbitrary artist IDs to the player
         const songs = await searchYouTube(`${artist.name} official hits`, 10);
         if (songs?.length) actions.play(songs[0]);
      }
    }));
  }, [followedArtists, actions]);

  // 2. TRENDING: YT Music Charts
  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch(
           `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&maxResults=15&regionCode=IN&key=${YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        const curated = (data.items || []).map(v => ({
           id: `yt-${v.id}`,
           title: v.snippet.title.replace(/\(.*?\)|\[.*?\]/g, "").trim(),
           artist: v.snippet.channelTitle.replace(" - Topic", ""),
           image: v.snippet.thumbnails?.medium?.url,
           category: "YouTube"
        }));
        setTrending(curated);
      } catch (e) {
        console.error("Home trending fetch failed", e);
      }
    }
    fetchTrending();
  }, []);

  // 2.5 PODCASTS: Top 10 trending podcasts
  useEffect(() => {
    async function fetchPodcasts() {
      try {
        const q = encodeURIComponent("podcast official channel full episode");
        const res = await fetch(
           `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=10&order=viewCount&regionCode=IN&key=${YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        const curated = (data.items || []).map(v => ({
           id: `pod-${v.id.videoId}`,
           title: v.snippet.title.replace(/\(.*?\)|\[.*?\]/g, "").trim(),
           artist: v.snippet.channelTitle,
           image: v.snippet.thumbnails?.medium?.url,
           category: "Podcast"
        }));
        setPodcasts(curated);
      } catch (e) {
        console.error("Home podcasts fetch failed", e);
      }
    }
    fetchPodcasts();
  }, []);

  // 3. NEW RELEASES: Enhanced logic (3-4 songs per artist, random subset)
  useEffect(() => {
    async function fetchNew() {
      if (followedArtists.length === 0) {
        // High quality mock new releases
        setNewReleases([
          { id: "nr-1", title: "Millionaire", artist: "Yo Yo Honey Singh", image: "https://i.ytimg.com/vi/6X7p3O2rO30/maxresdefault.jpg", category: "YouTube" },
          { id: "nr-2", title: "Tauba Tauba", artist: "Karan Aujla", image: "https://i.ytimg.com/vi/VzFmD67E0A0/maxresdefault.jpg", category: "YouTube" },
          { id: "nr-3", title: "Ishq", artist: "Faheem Abdullah", image: "https://i.ytimg.com/vi/N6S0u6KzU_w/maxresdefault.jpg", category: "YouTube" },
          { id: "nr-4", title: "Winning Stepper", artist: "Karan Aujla", image: "https://i.ytimg.com/vi/p8nLhF-mX_A/maxresdefault.jpg", category: "YouTube" }
        ]);
        return;
      }

      // Pick a random subset of followed artists (up to 4)
      const subset = [...followedArtists].sort(() => 0.5 - Math.random()).slice(0, 4);
      let allResults = [];
      
      for (const artist of subset) {
         try {
           // Search specifically for "latest [Artist Name] official songs" to get more than one
           const yt = await searchYouTube(`${artist.name} latest official full song`, 4);
           if (yt && yt.length > 0) {
              const artistSongs = yt.slice(0, 4).map(song => ({
                 ...song,
                 tag: "New from " + artist.name
              }));
              allResults = [...allResults, ...artistSongs];
           }
         } catch(e) {
           console.warn(`Failed to fetch new releases for ${artist.name}`);
         }
      }
      
      // Randomize the proportion/order
      const shuffled = allResults.sort(() => 0.5 - Math.random());
      setNewReleases(shuffled);
      setLoading(false);
    }
    
    fetchNew();
  }, [followedArtists.length]);

  return {
    flowCast: flowCastData,
    trending,
    newReleases,
    podcasts,
    loading,
    // Dynamic smart mixes: Now with onPlay functionality
    smartMixes: [
       { 
         id: "sm-1", title: "Punjabi Vibes", subtitle: "Deep Sidhu, Shubh...", 
         image: proxy("https://images.unsplash.com/photo-1514525253344-a812df93602c?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("latest punjabi hits 2024 official", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       },
       { 
         id: "sm-2", title: "Hindi Romantic", subtitle: "Arijit, Darshan Raval...", 
         image: proxy("https://images.unsplash.com/photo-1453090927415-5f353604e5a1?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("hindi romantic hits arijit singh", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       },
       { 
         id: "sm-3", title: "Lo-fi Relax", subtitle: "Quiet beats for focus", 
         image: proxy("https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("lofi hip hop chill beats relax", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       },
       { 
         id: "sm-4", title: "English Pop", subtitle: "Top hits across the globe", 
         image: proxy("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("top english pop hits 2024", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       },
       { 
         id: "sm-5", title: "Rap & Hip-Hop", subtitle: "Hard-hitting bars", 
         image: proxy("https://images.unsplash.com/photo-1571343729961-d6a992be7a84?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("desi rap hip hop hits official", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       },
       { 
         id: "sm-6", title: "Bhajan & Devotional", subtitle: "Find your inner peace", 
         image: proxy("https://images.unsplash.com/photo-1582560469792-540c4912946c?auto=format&fit=crop&w=400&q=80"), 
         onPlay: async () => {
           const songs = await searchYouTube("top bhajan devotional hits", 12);
           if (songs?.length) {
              playItem(songs[0], { keepQueue: false });
              replaceQueue(songs.slice(1), "ml");
           }
         }
       }
    ]
  };
}
