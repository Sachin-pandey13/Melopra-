import { useRef, useState, useEffect } from "react";
import LiveAlbumArt from "./components/LiveAlbumArt";
import ImmersivePanel from "./components/ImmersivePanel";
import Header from "./components/Header";
import TiltCard from "./components/TiltCard";
import LoginForm from "./components/LoginForm";
import PlaylistCard from "./components/PlaylistCard";
import YouTube from "react-youtube";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "./index.css";
import { useAuth } from "./contexts/AuthContext";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import CenterSections from "./components/center/CenterSections";
import OnboardingPage from "./components/OnboardingPage";
import FlowCastSection from "./components/center/FlowCastSection";
import { arrayUnion, increment } from "firebase/firestore";
import { learnPlay, applyDecay } from "./utils/listeningMemory";

import { useContextMenu } from "./contexts/ContextMenuContext";
import useRightClick from "./hooks/useRightClick";
import ContextMenu from "./components/ContextMenu";
import ArtistPlaylistView from "./components/center/ArtistPlaylistView";
import useQueueManager from "./hooks/useQueueManager";
import usePlayerController from "./hooks/usePlayerController";
import useLibraryController from "./hooks/useLibraryController";
import LeftSidebar from "./layouts/LeftSidebar";
import CenterPanel from "./layouts/CenterPanel";
import RightPanel from "./layouts/RightPanel";
import Overlays from "./layouts/Overlays";



import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";


const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const PLAYED_KEY = "melopra_played_yt";
const SAVED_YT_RESULTS = "melopra_yt_results";

const localAlbums = [
  {
    id: "local-1",
  title: "Zoro - The Swordsman",
  artist: "One Piece OST",
  image: "/src/assets/zoro.jpg",
  audio: "/sample.mp3",
  video: "/sample-video.mp4",
  lyrics: [
    { time: 0, line: "The wind howls over Wano..." },
    { time: 5, line: "A swordsman walks silently." },
    { time: 10, line: "His eyes burn with resolve." },
    { time: 15, line: "Three blades, one soul." },
  ],
  language: "Japanese",
  category: "Anime",
},
];

function RecentItem({ album, onPlay, isFavorite }) {
  const { onContextMenu } = useRightClick({
    id: album.id,
    title: album.title,
    artist: album.artist,
    category: album.category,
    youtubeId: album.youtubeId,
    liked: isFavorite(album.id),
  });

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
      onClick={() => onPlay(album)}
      onContextMenu={onContextMenu}
    >
      <img
        src={album.imageUrl || album.thumbnail || album.cover || album.image}
        alt={album.title}
        className="w-12 h-12 rounded object-cover"
      />
      <div>
        <p className="text-sm font-semibold">{album.title}</p>
        <p className="text-xs text-white/60">
          {album.artist || "Unknown Artist"}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const audioRef = useRef(null);
  const playHistoryRef = useRef([]);
  const { logout } = useAuth();
  const youtubePlayerRef = useRef(null);

 const [currentUser, setCurrentUser] = useState(null);
const library = useLibraryController({ currentUser });

// Basic genre classifier - expand later
const resolveGenre = (song) => {
  const t = (song.title || "").toLowerCase();
  const a = (song.artist || "").toLowerCase();

  if (a.includes("divine") || a.includes("eminem") || t.includes("rap")) return "Rap";
  if (a.includes("karan aujla") || a.includes("sidhu") || a.includes("ap dhillon")) return "Punjabi";
  if (t.includes("lofi") || t.includes("chill")) return "Lofi";
  if (a.includes("arijit") || t.includes("romantic")) return "Romantic";
  return "Mixed";
};

// Track interest weight in local storage
const updateInterestWeights = (song, type = "play") => {
  let interest = JSON.parse(localStorage.getItem("melopra_interest")) || {};

  const genre = resolveGenre(song);
  const weight = type === "play" ? 3 : 1; // play > replay

  interest[genre] = (interest[genre] || 0) + weight;
  localStorage.setItem("melopra_interest", JSON.stringify(interest));
};


const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [albums, setAlbums] = useState(localAlbums);
const [selectedAlbum, setSelectedAlbum] = useState(null);
const [isImmersiveVisible, setIsImmersiveVisible] = useState(false);
  const [bgColor, setBgColor] = useState("black");
const [panelGlowColor, setPanelGlowColor] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [youtubeId, setYoutubeId] = useState(null);

  const [userDoc, setUserDoc] = useState(null);
  const [canvasVideo, setCanvasVideo] = useState(null);

  const [autoplayQueue, setAutoplayQueue] = useState([]);
const [playedThisSession, setPlayedThisSession] = useState(new Set());

const [showOnboarding, setShowOnboarding] = useState(false);

const [panelLeft, setPanelLeft] = useState(20);    // percent
const [panelCenter, setPanelCenter] = useState(60);
const [panelRight, setPanelRight] = useState(20);
const [isResizing, setIsResizing] = useState(false);
const resizeRef = useRef({ edge: null, startX: 0, startLeft: 0, startCenter: 0, startRight: 0 });

const MIN_PANEL_PCT = 10; // minimum percent width per panel (adjustable)

const centerPanelRef = useRef(null);
const immersivePanelRef = useRef(null);
const leftPanelRef = useRef(null);


  // queues / dropdown
  const [playNextQueue, setPlayNextQueue] = useState([]);
  const [dropdownVisibleId, setDropdownVisibleId] = useState(null);
  const [showQueuePanel, setShowQueuePanel] = useState(false); // NEW

  // 🔧 Header queue sync (FIXES crash)
const handleQueueUpdate = (queue) => {
  if (!Array.isArray(queue)) return;
  setPlayNextQueue(queue);
};

  // YouTube search + persistence of played songs
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [playedYouTube, setPlayedYouTube] = useState([]);

  // YouTube "Next / Related" list for the currently playing YouTube song
  const [youtubeNextUp, setYoutubeNextUp] = useState([]);
  const [youtubeNextPointer, setYoutubeNextPointer] = useState(0);

  // ---------------- utils ----------------
  const filterJunk = (title = "") => {
    const t = title.toLowerCase();
    const badKeywords = [
      "shorts",
      "#shorts",
      "status",
      "clip",
      "funny",
      "trending",
      "edit",
      "scene",
      "teaser",
      "trailer",
      "reaction",
      "meme",
      "challenge",
      "prank",
      "asmr",
      "vlog",
      "episode",
      "live",
      "durian",
    ];
    return !badKeywords.some((word) => t.includes(word));
  };
const handleAlbumSelect = async (album, enqueueOnly = false) => {
  if (!currentUser && !enqueueOnly) {
  setShowLoginModal(true);
  return;
}
  if (!album) return;

  // Queue if "Play Next"
  if (enqueueOnly) {
     enqueue(album);
    return;
  }

  // 🔄 Normalize album object

const normalizedAlbum = {
  id: album.id || null,
  title: album.title || album.name || "Unknown Title",
  artist: album.artist || album.channelTitle || "Unknown Artist",
  image:
    album.image ||
    album.thumbnail ||
    album.thumbnails?.high?.url ||
     null,

  audio:
    album.audio ||
    album.streamUrl ||
    "",

  channelId:
    album.channelId ||
    album.snippet?.channelId ||
    album.artistChannelId ||
    album.channel ||
    null,

  category:
    album.category ||
    (album.audio?.includes("youtube.com") ||
    album.id?.startsWith("yt-") ||
    album.id?.startsWith("firestore-")
      ? "YouTube"
      : "Local"),

  video: album.video || null,
};





  // ✅ Update state for immersive panel
  setSelectedAlbum(normalizedAlbum);
  setIsImmersiveVisible(true);
  setHasInteracted(true);
  library.addRecentPlay(normalizedAlbum);

// 🕒 Save play history (avoid duplicates back-to-back)
const history = playHistoryRef.current;
const last = history[history.length - 1];

if (!last || last.id !== normalizedAlbum.id) {
  history.push(normalizedAlbum);

  // Optional cap to prevent memory bloat
  if (history.length > 50) history.shift();
}



// 🎯 Learn listening preference before saving to Firestore
const genre = resolveGenre(normalizedAlbum);
learnPlay(normalizedAlbum);
applyDecay(7); 
updateInterestWeights(normalizedAlbum, "play");

// 🧠 Mark this song as played in this session (CRITICAL for autoplay)
setPlayedThisSession(prev => {
  const next = new Set(prev);
  next.add(normalizedAlbum.id);
  return next;
});


let lc = JSON.parse(localStorage.getItem("melopra_listen_count") || "{}");
lc[normalizedAlbum.artist.toLowerCase()] = (lc[normalizedAlbum.artist.toLowerCase()] || 0) + 1;
localStorage.setItem("melopra_listen_count", JSON.stringify(lc))

  // 🔥 Sync behavior to Firestore for Interest Section
// 🔥 Sync behavior to Firestore for Interest Section
try {
  if (currentUser?.uid && normalizedAlbum?.artist) {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      recentlyPlayed: arrayUnion({
        id: normalizedAlbum.id,
        title: normalizedAlbum.title,
        artist: normalizedAlbum.artist,
        image: normalizedAlbum.image,
        playedAt: Date.now(),
        genre: genre || null,
      }),

      interestWeights: {
        [normalizedAlbum.artist.toLowerCase().trim()]: increment(1),
        ...(genre ? { [genre.toLowerCase().trim()]: increment(1) } : {})
      }
    });
  }
} catch (err) {
  console.warn("⚠️ Failed to update Firestore interest", err);
}

// 🎧 YouTube playback (PRODUCTION-SAFE)
if (normalizedAlbum.category === "YouTube") {

  const audio = audioRef.current;
  if (audio && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }

  const vid = extractYouTubeId(normalizedAlbum);

  if (!vid || vid.length !== 11) {
    console.warn("❌ Invalid YouTube ID:", vid, normalizedAlbum);
    return;
  }

  console.log("🎬 Playing YouTube ID:", vid);

  // Reset any previous YT-related state cleanly
  setYoutubeNextUp([]);
  setYoutubeNextPointer(0);

  // Set current video
  setYoutubeId(vid);
  setIsPlaying(true);

  // Background / immersive canvas (NO autoplay logic elsewhere)
  setCanvasVideo(
    `https://www.youtube.com/embed/${vid}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1`
  );

  // Pre-fetch related / next videos (best-effort)
  try {
    const nextList = await fetchYouTubeNext(vid);
    setYoutubeNextUp(Array.isArray(nextList) ? nextList : []);
  } catch (e) {
    console.warn("YT next fetch failed", e);
    setYoutubeNextUp([]);
  }

  return; // 🚨 REQUIRED — prevents local audio logic from running
}

const audio = audioRef.current;

// 🎵 Local / non-YouTube audio
setYoutubeId(null);
setYoutubeNextUp([]);
setYoutubeNextPointer(0);

if (audio) {
  audio.src = normalizedAlbum.audio;
  audio.load();
  try {
    await audio.play();
    setIsPlaying(true);
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}
};


// ---- AUTOPLAY QUEUE GENERATOR (SAFE + DEFENSIVE) ----
const generateAutoplayQueue = async (seedAlbum) => {
  if (!seedAlbum) return [];

  let candidates = [];

  // 1️⃣ YouTube related (defensive)
  if (seedAlbum.category === "YouTube") {
    const vid = extractYouTubeId(seedAlbum);

    if (vid) {
      try {
        const related = await fetchYouTubeNext(vid);
        if (Array.isArray(related)) {
          candidates.push(...related);
        }
      } catch (err) {
        console.warn("Autoplay YT fetch failed", err);
      }
    }
  }

  // 2️⃣ Same artist fallback (local / firestore / audius)
  if (candidates.length < 5 && seedAlbum.artist) {
    const sameArtist = albums.filter(
      (a) =>
        a.artist === seedAlbum.artist &&
        a.id !== seedAlbum.id &&
        !playedThisSession.has(a.id)
    );
    candidates.push(...sameArtist);
  }

  // 3️⃣ Global fallback (last resort)
  if (candidates.length < 5) {
    candidates.push(
      ...albums.filter(
        (a) =>
          a.id !== seedAlbum.id &&
          !playedThisSession.has(a.id)
      )
    );
  }

  // 🚫 De-duplicate + remove already played
  const unique = [];
  const seen = new Set();

  for (const c of candidates) {
    if (!c?.id) continue;
    if (seen.has(c.id)) continue;
    if (playedThisSession.has(c.id)) continue;

    seen.add(c.id);
    unique.push(c);

    if (unique.length >= 10) break;
  }

  return unique;
};

  const queue = useQueueManager({
  playNextQueue,
  setPlayNextQueue,
  autoplayQueue,
  setAutoplayQueue,
  selectedAlbum,
  isPlaying,
  handleAlbumSelect,
  generateAutoplayQueue,
});

const {
  playNext,
  enqueue,
  enqueueMany,
  remove,
  move,
  clear,
} = queue;

  const isOfficialChannel = (channelTitle = "") => {
    const ch = channelTitle.toLowerCase();
    return (
      ch.includes("official") ||
      ch.includes("vevo") ||
      ch.includes("music") ||
      ch.includes("records") ||
      ch.includes("recordings")
    );
  };

  const isArtistOrBandQuery = (q = "") => {
    const lowered = q.toLowerCase().trim();
    const tokens = lowered.split(/\s+/);
    const songHints = [
      "official",
      "lyrics",
      "video",
      "audio",
      "ft",
      "feat",
      "remix",
      "mix",
      "cover",
      "karaoke",
    ];
    if (songHints.some((w) => lowered.includes(w))) return false;
    return tokens.length <= 3;
  };

// ---------------- YouTube helpers ----------------
const extractYouTubeId = (album) => {
    if (!album) return null;
  // Firestore-style id: firestore-<ytid>
  if (typeof album.id === "string" && album.id.startsWith("firestore-")) {
    const maybeId = album.id.replace("firestore-", "");
    if (maybeId.length === 11) return maybeId;
  }

  // yt-<id>
  if (typeof album.id === "string" && album.id.startsWith("yt-")) {
    return album.id.replace("yt-", "");
  }

  // Raw 11-char ID
  if (typeof album.id === "string" && album.id.length === 11) {
    return album.id;
  }

  // Parse from URL
  const url = album.audio || album.video || "";
  const match = url.match(/[?&]v=([0-9A-Za-z_-]{11})/);
  if (match) return match[1];

  return null;
};


  const yt = {
  fetchYT: async (endpoint, params) => {
    const query = new URLSearchParams({
      ...params,
      key: YOUTUBE_API_KEY,
    }).toString();

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/${endpoint}?${query}`
    );

    if (!res.ok) {
      throw new Error(`YT ${endpoint} failed`);
    }

    return res.json();
  },
};


// ✅ Listen to Firebase Auth state and update currentUser
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
  });
  return () => unsubscribe();
}, []);


// 🔄 Reset autoplay + session history on logout / user change
useEffect(() => {
  if (!currentUser) {
    setPlayedThisSession(new Set());
    setAutoplayQueue([]);
  }
}, [currentUser]);



// 🧠 Check if onboarding is needed for new users (robust to permission errors)
useEffect(() => {
  const checkUserProfile = async () => {
    if (!currentUser?.uid) {
      setShowOnboarding(false);
      return;
    }

    try {
      const ref = doc(db, "users", currentUser.uid);
      const snap = await getDoc(ref);

      // if doc missing or missing prefs -> show onboarding
      if (!snap.exists() || !snap.data()?.favoriteArtists?.length || !snap.data()?.selectedLanguages?.length) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    } catch (err) {
      console.warn("Failed to check onboarding state:", err);

      // If permission issue, show onboarding so user can set preferences locally (or you can surface admin message)
      const msg = (err && err.code) || (err && err.message) || "";
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("insufficient")) {
        console.warn("Firestore permission denied while checking profile - showing onboarding to let user set preferences.");
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  };

  checkUserProfile();
}, [currentUser]);

useEffect(() => {
  const keepAlive = setInterval(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.currentTime += 0.00001;
      audio.currentTime -= 0.00001;
    }
  }, 15000);

  return () => clearInterval(keepAlive);
}, []);



// 🔥 Fetch Firestore user doc and trigger onboarding if needed
useEffect(() => {
  let mounted = true;

  const loadUserDoc = async () => {
    if (!currentUser?.uid) {
      setUserDoc(null);
      return;
    }

    try {
      const ref = doc(db, "users", currentUser.uid);
      const snap = await getDoc(ref);
      if (!mounted) return;

      if (snap.exists()) {
        const data = snap.data();
        setUserDoc(data);

        // ✅ Check if onboarding is needed
        if (
          !data.selectedLanguages ||
          data.selectedLanguages.length === 0 ||
          !data.favoriteArtists ||
          data.favoriteArtists.length === 0
        ) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }
      } else {
        // No user profile found — trigger onboarding for first-time user
        setShowOnboarding(true);
      }
    } catch (err) {
      console.warn("Failed to load user doc", err);
    }
  };

  loadUserDoc();
  return () => {
    mounted = false;
  };
}, [currentUser]);


useEffect(() => {
  if (selectedAlbum) {
    setIsImmersiveVisible(true);
  }
}, [selectedAlbum]);

useEffect(() => {
  const handleResizeCursor = (e) => {
    const panels = document.querySelectorAll('.resizable-panel');

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const mouseX = e.clientX;
      const nearLeftEdge = Math.abs(mouseX - rect.left) < 6;
      const nearRightEdge = Math.abs(mouseX - rect.right) < 6;

      if (nearLeftEdge || nearRightEdge) {
        panel.style.cursor = "col-resize";
      } else {
        panel.style.cursor = "";
      }
    });
  };

  window.addEventListener("mousemove", handleResizeCursor);
  return () => {
    window.removeEventListener("mousemove", handleResizeCursor);
  };
}, []);


useEffect(() => {
  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  }

  // 🔧 Ensure global callback initializes cleanly
  window.onYouTubeIframeAPIReady = () => {
    console.log("✅ YouTube IFrame API is ready.");
  };
}, []);




// ✅ Dynamic Panel Color Extraction (clean + safe)
useEffect(() => {
  if (!selectedAlbum?.image) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src =
    selectedAlbum.imageUrl ||
    selectedAlbum.thumbnail ||
    selectedAlbum.cover ||
    selectedAlbum.image;

  img.onload = () => {
    try {
      // Create canvas *only* in memory — never appended to DOM
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = 50; // small sample for performance
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);

      const imageData = ctx.getImageData(0, 0, 50, 50);
      let [r, g, b] = [0, 0, 0];
      const pixels = imageData.data.length / 4;

      for (let i = 0; i < imageData.data.length; i += 4) {
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
      }

      r = Math.floor(r / pixels);
      g = Math.floor(g / pixels);
      b = Math.floor(b / pixels);

      const glow = `rgba(${r}, ${g}, ${b}, 0.35)`;
      const background = `linear-gradient(to right, rgba(${r},${g},${b},0.25), #000)`;

      setPanelGlowColor(glow);
      setBgColor(background);
    } catch (e) {
      console.warn("Color extraction failed:", e);
    }
  };

  return () => {
    // Explicit cleanup if any leftover
    [...document.querySelectorAll("canvas")]
      .forEach((el) => el.parentNode === document.body && el.remove());
  };
}, [selectedAlbum]);

  // -------------- drag immersive panel --------------

  // -------------- debounce search --------------
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedTerm(searchTerm), 1000);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // -------------- Firestore songs --------------
useEffect(() => {
  const fetchFirestoreSongs = async () => {
    try {
      const snapshot = await getDocs(collection(db, "songs"));

      const firestoreSongs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        let videoId =
          data.videoId ||
          data.youtubeId ||
          null;

        if (!videoId && data.image) {
          const match = data.image.match(/vi\/([0-9A-Za-z_-]{11})/);
          if (match) videoId = match[1];
        }

        return {
          id: `firestore-${docSnap.id}`,
          title: data.title || "Unknown",
          artist: data.artist || "Unknown",
          image:
            data.image ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
          audio: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
          lyrics: data.lyrics || [],
          language: data.language || "English",
          category: "YouTube",
          videoId,
        };
      });

      // ✅ THIS WAS MISSING
      setAlbums((prev) => {
        const existing = new Set(prev.map((a) => a.id));
        const unique = firestoreSongs.filter((s) => !existing.has(s.id));
        return [...prev, ...unique];
      });
    } catch (err) {
      console.warn("Failed to fetch Firestore songs", err);
    }
  };

  fetchFirestoreSongs();
}, []);


  // -------------- Audius tracks --------------
  useEffect(() => {
    fetch("https://api.audius.co/v1/tracks/trending?limit=10&app_name=melopra")
      .then((res) => res.json())
      .then((data) => {
        const audiusTracks = data.data.map((track) => ({
          id: `audius-${track.id}`,
          title: track.title,
          artist: track.user?.name || "Unknown",
          image: track.artwork?.["150x150"],
          audio: `http://localhost:4000/proxy?url=https://api.audius.co/v1/tracks/${track.id}/stream?app_name=melopra`,
          video: "/sample-video.mp4",
          lyrics: [],
          language: "English",
          category: "Audius",
        }));
        setAlbums((prev) => {
          const unique = audiusTracks.filter((s) => !prev.some((p) => p.id === s.id));
          return [...prev, ...unique];
        });
      });
  }, []);

  // -------------- JSON songs --------------
  useEffect(() => {
    fetch("/songs.json")
      .then((res) => res.json())
      .then((data) => {
        const structured = data.map((song, idx) => ({
          id: `custom-${Date.now()}-${idx}`,
          ...song,
          video: song.video || "/sample-video.mp4",
          lyrics: song.lyrics || [],
          language: song.language || "English",
          category: song.category || "Misc",
        }));
        setAlbums((prev) => {
          const unique = structured.filter((s) => !prev.some((p) => p.audio === s.audio));
          return [...prev, ...unique];
        });
      });
  }, []);

  // -------------- Load YouTube results (separate) from localStorage --------------
  useEffect(() => {
    const savedYTResults = localStorage.getItem(SAVED_YT_RESULTS);
    if (savedYTResults) {
      try {
        const parsed = JSON.parse(savedYTResults);
        setYoutubeSearchResults(parsed);
      } catch {
        console.warn("Failed to parse saved YouTube results");
      }
    }
  }, []);

  // -------------- Load & persist played YT --------------
  useEffect(() => {
    const saved = localStorage.getItem(PLAYED_KEY);
    if (saved) {
      try {
        setPlayedYouTube(JSON.parse(saved));
      } catch {
        console.warn("Failed to parse", PLAYED_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(playedYouTube));
  }, [playedYouTube]);


const updateRecentlyPlayed = (album) => {
  let recent = JSON.parse(localStorage.getItem("melopra_recent_played")) || [];

  recent = recent.filter((a) => a.id !== album.id);

  recent.unshift({
    ...album,
    channelId:
      album.channelId ||
      album.ownerChannelId ||
      album.artistChannelId ||
      album.channel ||
      (album.audio?.split("youtube.com/watch?v=")[1] ? null : null),
    playedAt: Date.now(),
  });

  if (recent.length > 10) recent.pop();
  localStorage.setItem("melopra_recent_played", JSON.stringify(recent));

   const genre = resolveGenre(album);
  updateInterestWeights(album, "replay", genre);
};



  // -------------- YouTube helpers --------------
  const fetchTopVideosByViews = async (term) => {
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          term
        )}&type=video&maxResults=25&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      const ids = (searchData.items || []).map((i) => i.id.videoId).join(",");
      if (!ids) return [];

      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}&key=${YOUTUBE_API_KEY}`
      );
      const statsData = await statsRes.json();

      return (statsData.items || [])
        .filter((video) => filterJunk(video.snippet.title))
        .sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount))
        .slice(0, 10)
        .map((item) => ({
          id: `yt-${item.id}`,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          image: item.snippet.thumbnails?.medium?.url,
          audio: `https://www.youtube.com/watch?v=${item.id}`,
          video: "",
          lyrics: [],
          language: "English",
          category: "YouTube",
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
        }));
    } catch (err) {
      console.warn("Error fetching top YouTube songs", err);
      return [];
    }
  };

  // Fetch YouTube related/next videos for "next section" feature
  const fetchYouTubeNext = async (videoId) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=20&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      const items =
        (data.items || [])
          .filter((item) => {
            const title = item.snippet.title;
            return filterJunk(title);
          })
          .map((item) => ({
            id: `yt-${item.id.videoId}`,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            image: item.snippet.thumbnails?.medium?.url,
            audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            video: "",
            lyrics: [],
            language: "English",
            category: "YouTube",
          })) || [];
      return items;
    } catch (e) {
      console.warn("Failed to fetch YouTube Next", e);
      return [];
    }
  };

  // -------------- YouTube search --------------
  useEffect(() => {
    if (!debouncedTerm || debouncedTerm.length < 2 || !YOUTUBE_API_KEY) return;

    const run = async () => {
      const artistSearch = isArtistOrBandQuery(debouncedTerm);

      if (artistSearch) {
        const ytResults = await fetchTopVideosByViews(debouncedTerm);
        setYoutubeSearchResults(ytResults);
        localStorage.setItem(SAVED_YT_RESULTS, JSON.stringify(ytResults));
      } else {
        try {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
              debouncedTerm
            )}&type=video&maxResults=15&key=${YOUTUBE_API_KEY}`
          );
          const data = await res.json();
          const ytResults =
            (data.items || [])
              .filter((item) => {
                const title = item.snippet.title;
                const channel = item.snippet.channelTitle;
                return filterJunk(title) && isOfficialChannel(channel);
              })
              .slice(0, 2)
              .map((item) => ({
                id: `yt-${item.id.videoId}`,
                title: item.snippet.title,
                artist: item.snippet.channelTitle,
                image: item.snippet.thumbnails?.medium?.url,
                audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                video: "",
                lyrics: [],
                language: "English",
                category: "YouTube",
              })) || [];

          setYoutubeSearchResults(ytResults);
          localStorage.setItem(SAVED_YT_RESULTS, JSON.stringify(ytResults));
        } catch (e) {
          console.warn(e);
        }
      }
    };

    run();
  }, [debouncedTerm]);

const isFavorite = (id) => library.isFavorite(id);

const toggleFavorite = async (album) => {
  if (!currentUser) return setShowLoginModal(true);
  try {
    await library.toggleFavorite(album);
  } catch (e) {
    console.warn("Favorite toggle failed", e);
  }
};

  // -------------- delete saved YT album/song --------------
  const handleDeleteSaved = (albumId) => {
    setPlayedYouTube((prev) => prev.filter((a) => a.id !== albumId));
  };

  // -------------- delete album (non-YT saved) --------------
  const handleAlbumDelete = (albumId) => {
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    if (selectedAlbum?.id === albumId) {
      setSelectedAlbum(null);
      setIsPlaying(false);
      setYoutubeId(null);
    }
  };

  // -------------- YouTube player callbacks --------------
const handleYouTubeReady = (event) => {
  youtubePlayerRef.current = event.target;
};


  // -------------- native audio end --------------
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  const onEnd = () => {
    console.log("🎵 Track ended");
    setIsPlaying(false);
   playNext();
  };

  audio.addEventListener("ended", onEnd);

  return () => {
    audio.removeEventListener("ended", onEnd);
  };
}, [playNext]);

useEffect(() => {
  const onVisibility = () => {
    const audio = audioRef.current;
    if (
      document.visibilityState === "visible" &&
      audio &&
      audio.ended
    ) {
      console.log("🔄 Missed next-track while hidden, fixing");
      playNext();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  return () =>
    document.removeEventListener("visibilitychange", onVisibility);
}, []);


  // -------------- live progress bar --------------
 useEffect(() => {
  const interval = setInterval(() => {
    const audio = audioRef.current;
    const yt = youtubePlayerRef.current;

    if (selectedAlbum?.category === "YouTube" && yt) {
      const current = yt.getCurrentTime?.();
      const duration = yt.getDuration?.();
      if (!isNaN(current) && !isNaN(duration) && duration > 0) {
        document.documentElement.style.setProperty(
          "--song-progress",
          current / duration
        );
      }
      return;
    }

    if (audio?.duration && !isNaN(audio.duration)) {
      document.documentElement.style.setProperty(
        "--song-progress",
        audio.currentTime / audio.duration
      );
    }
  }, 500);

  return () => clearInterval(interval);
}, [selectedAlbum]);


// -------------- what to show --------------
const listToShow =
  library.activePlaylist
    ? library.playlistTracks
    : searchTerm.trim() && youtubeSearchResults.length > 0
      ? youtubeSearchResults
      : [
          ...albums,
          ...playedYouTube.filter(
            (p) => !albums.some((a) => a.id === p.id)
          ),
        ];



  const visibleAlbums = listToShow.filter((album) => {
    const title = (album.title || "").toLowerCase();
    const artist = (album.artist || "").toLowerCase();
    const cat = (album.category || "").trim().toLowerCase();
    const search = searchTerm.toLowerCase();
    const selected = category.trim().toLowerCase();

    if (listToShow === youtubeSearchResults) {
      return selected === "all" || cat === selected;
    }

    return (
      filterJunk(title) &&
      (title.includes(search) || artist.includes(search)) &&
      (selected === "all" || cat === selected)
    );
  });



const startResize = (e, edge) => {
  e.preventDefault();
  setIsResizing(true);
  resizeRef.current = {
    edge,
    startX: e.clientX,
    startLeft: panelLeft,
    startCenter: panelCenter,
    startRight: panelRight,
  };

  const onMove = (moveEvent) => {
    const dx = moveEvent.clientX - resizeRef.current.startX;
    const pctDelta = (dx / window.innerWidth) * 100;

    if (resizeRef.current.edge === "left-center") {
      let newLeft = resizeRef.current.startLeft + pctDelta;
      let newCenter = resizeRef.current.startCenter - pctDelta;

      // clamp
      newLeft = Math.max(MIN_PANEL_PCT, Math.min(newLeft, resizeRef.current.startLeft + resizeRef.current.startCenter - MIN_PANEL_PCT));
      newCenter = Math.max(MIN_PANEL_PCT, Math.min(newCenter, resizeRef.current.startCenter + resizeRef.current.startLeft - MIN_PANEL_PCT));

      setPanelLeft(Number(newLeft.toFixed(2)));
      setPanelCenter(Number(newCenter.toFixed(2)));
    } else if (resizeRef.current.edge === "center-right") {
      let newCenter = resizeRef.current.startCenter + pctDelta;
      let newRight = resizeRef.current.startRight - pctDelta;

      newCenter = Math.max(MIN_PANEL_PCT, Math.min(newCenter, resizeRef.current.startCenter + resizeRef.current.startRight - MIN_PANEL_PCT));
      newRight = Math.max(MIN_PANEL_PCT, Math.min(newRight, resizeRef.current.startRight + resizeRef.current.startCenter - MIN_PANEL_PCT));

      setPanelCenter(Number(newCenter.toFixed(2)));
      setPanelRight(Number(newRight.toFixed(2)));
    }
  };

  const onUp = () => {
    setIsResizing(false);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};


const albumArtSize = Math.max(120, Math.min(260, (panelCenter / 100) * 400));

// 🧠 Handle playback when Melo triggers a song
// 🧠 Handle playback or queue when Melo triggers an action
const handleMeloPlay = (song, enqueueOnly = false) => {
  if (!song) return;

  const normalized = {
    id: song.id || `melo-${Date.now()}`,
    title: song.title || "Unknown Song",
    artist: song.artist || "Unknown Artist",
    image: song.image || song.thumbnail || "/placeholder.jpg",
    audio: song.audio || song.url || "",
    category: song.category || "YouTube",
    video:
      song.video ||
      (song.video_id
        ? `https://www.youtube.com/embed/${song.video_id}?autoplay=1&mute=1&controls=0`
        : null),
  };

  // ✅ If user said "add to queue" or no song is playing yet
  if (enqueueOnly || !selectedAlbum) {
    console.log("🎶 Added to queue (via Melo):", normalized);
    setPlayNextQueue((prev) => [...prev, normalized]);
    return;
  }

  // ✅ Otherwise play directly
  console.log("🎶 Melo triggered play:", normalized);
  handleAlbumSelect(normalized);
};

// after handleAlbumSelect + generateAutoplayQueue


const player = usePlayerController({
  audioRef,
  youtubePlayerRef,
  selectedAlbum,
  setIsPlaying,
  playNext,
});

const handlePrev = () => {
  try {
    const history = playHistoryRef.current;

    // Need at least 2 songs to go back
    if (history.length < 2) {
      console.log("⏮ No previous track in history");
      return;
    }

    // Remove current track
    history.pop();

    // Play previous
    const prev = history[history.length - 1];

    if (prev) {
      console.log("⏮ Playing previous:", prev.title || prev.id);
      handleAlbumSelect(prev);
    }
  } catch (err) {
    console.warn("handlePrev failed:", err);
  }
};


return (
  <div className="app-root">

  <div
    className="relative w-full h-screen text-white overflow-hidden flex flex-col"
    style={{ background: "#0b0b0f" }}

  >

    {/* ✅ Onboarding Page */}
    {showOnboarding && currentUser && (
      <OnboardingPage
        user={currentUser}
        onComplete={() => {
          setShowOnboarding(false);
          window.location.reload(); // reloads after setup is done
        }}
      />
    )}

    {/* ✅ Render rest of Melopra UI only if onboarding is NOT active */}
    {!showOnboarding && (
      <>


<Header
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  onLoginClick={() => setShowLoginModal(true)}
  currentUser={currentUser}
  onLogout={logout}

  // Full AI control handlers
  onSongPlay={handleMeloPlay}
  onPause={player.pause}
  onResume={player.resume}
  onNext={playNext}
  onPrev={handlePrev}
  onQueueUpdate={handleQueueUpdate}
  onLike={library.toggleFavorite}
/>

        <div className="flex flex-grow gap-4 overflow-hidden p-2 relative h-full">

<LeftSidebar
  library={library}
  playNextQueue={playNextQueue}
  onPlay={handleAlbumSelect}
  panelLeft={panelLeft}
  setPanelLeft={setPanelLeft}
  isSidebarCollapsed={isSidebarCollapsed}
  setIsSidebarCollapsed={setIsSidebarCollapsed}
  panelGlowColor={panelGlowColor}
/>

<CenterPanel
  centerPanelRef={centerPanelRef}
  panelCenter={panelCenter}
  panelLeft={panelLeft}
  isImmersiveVisible={isImmersiveVisible}
  isResizing={isResizing}
  panelGlowColor={panelGlowColor}

  searchTerm={searchTerm}
  visibleAlbums={visibleAlbums}
  youtubeSearchResults={youtubeSearchResults}

  selectedAlbum={selectedAlbum}
  isPlaying={isPlaying}
  albumArtSize={albumArtSize}

  library={library}
  yt={yt}
  currentUser={currentUser}
  userDoc={userDoc}

  playNext={playNext}
  handleAlbumSelect={handleAlbumSelect}
  extractYouTubeId={extractYouTubeId}

  audioRef={audioRef}
  setIsPlaying={setIsPlaying}
/>

<RightPanel
  immersivePanelRef={immersivePanelRef}

  isImmersiveVisible={isImmersiveVisible}
  selectedAlbum={selectedAlbum}

  panelRight={panelRight}
  panelGlowColor={panelGlowColor}
  isResizing={isResizing}

  startResize={startResize}

  audioRef={audioRef}
  videoRef={videoRef}
  isPlaying={isPlaying}

  player={player}
  albums={albums}
  handleAlbumSelect={handleAlbumSelect}

  albumArtSize={albumArtSize}
  canvasVideo={canvasVideo}
/>
     </div>
     
<Overlays
  currentUser={currentUser}
  hasInteracted={hasInteracted}
  selectedAlbum={selectedAlbum}

  playNextQueue={playNextQueue}
  playNext={playNext}
  clearQueue={clear}
  player={player}
  isPlaying={isPlaying}

  showQueuePanel={showQueuePanel}
  setShowQueuePanel={setShowQueuePanel}
/>

      {/* YouTube Player */} 
      {youtubeId && (
      <YouTube
  videoId={youtubeId}
  opts={{
    width: "0",
    height: "0",
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    },
  }}
  onReady={handleYouTubeReady}
  onPlay={() => {
    setIsPlaying(true);
  }}
  onPause={() => {
    setIsPlaying(false);
  }}
  onEnd={() => {
    // 🔥 CRITICAL: release playing state first
    setIsPlaying(false);

    // 🔥 advance queue / autoplay
    playNext();
  }}
/>

      )}

      {/* Native Audio */}
      <audio ref={audioRef} preload="auto" />  

      {/* Login Modal */}
      {showLoginModal && (            
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <LoginForm onClose={() => setShowLoginModal(false)} />
        </div>
      )}
  
{library.showCreatePlaylistModal && ( 
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-white text-black p-6 rounded shadow-md w-[300px]">
      <h2 className="text-lg font-bold mb-3">Create Playlist</h2>

      <input
        type="text"
        value={library.newPlaylistName}
        onChange={(e) => library.setNewPlaylistName(e.target.value)}
        placeholder="Playlist name"
        className="border p-2 w-full mb-4 outline-none focus:ring-2 focus:ring-purple-600"
        autoFocus
      />

      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1 bg-gray-400 rounded"
          onClick={library.closeCreatePlaylist}
        >
          Cancel
        </button>

        <button
          className="px-3 py-1 bg-purple-600 text-white rounded disabled:opacity-50"
          disabled={!library.newPlaylistName.trim()}
          onClick={library.createNewPlaylist}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

{/* Add to Playlist Modal */}
{library.showAddToPlaylist && (
  <AddToPlaylistModal
    song={library.pendingAddSong}
    playlists={library.playlists}
    onAdd={(playlistId) => {
      library.addToPlaylist(library.pendingAddSong, playlistId);
      library.closeAddToPlaylist();
    }}
    onClose={library.closeAddToPlaylist}
  />
)}

{/* 🔥 GLOBAL CONTEXT MENU (production) */}
<ContextMenu
  onAddToQueue={(item) => {
    if (!item) return;
    enqueue(item); // ✅ NOT playNext.enqueue
  }}
  onAddToPlaylist={(item) => {
    if (!item) return;
    library.openAddToPlaylist(item);
  }}
  onToggleLike={(item) => {
    if (!item) return;
    library.toggleFavorite(item);
  }}
/>

  </>
)}
 </div>
 </div>
);
}
