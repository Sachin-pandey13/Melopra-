import { useEffect, useRef, useCallback } from "react";
import { useNowPlaying, playNext, normalizeId, playPrevious, togglePlay } from "../state/useNowPlaying";
import { setPlayerTime, setSeekListener } from "../state/usePlayerTime";
import { useAuth } from "../../contexts/AuthContext";
import { logUserEvent } from "../../api/logUserEvent";

let ytApiLoaded = false;
let ytApiLoadPromise = null;

function loadYTApi() {
  if (ytApiLoaded) return Promise.resolve();
  if (ytApiLoadPromise) return ytApiLoadPromise;
  ytApiLoadPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { ytApiLoaded = true; resolve(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { ytApiLoaded = true; resolve(); };
  });
  return ytApiLoadPromise;
}

export default function CustomAudioPlayer() {
  const { current, isPlaying } = useNowPlaying();
  const { currentUser } = useAuth();

  const playerRef = useRef(null);  // YT.Player instance
  const containerRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const isReadyRef = useRef(false);
  const timerRef = useRef(null);

  // ── Play duration tracking (for MongoDB event logging) ──────────────────
  const playStartRef = useRef(null);   // timestamp when current track started
  const songDurRef = useRef(0);         // total duration of current song

  // Helper: log event to backend (MongoDB + Firebase)
  const logEvent = useCallback((eventType) => {
    if (!currentUser || !current) return;
    const playDuration = playStartRef.current
      ? Math.floor((Date.now() - playStartRef.current) / 1000)
      : 0;
    logUserEvent({
      userId:       currentUser.uid,
      songId:       normalizeId(current.id),
      event:        eventType,
      playDuration,
      songDuration: songDurRef.current,
      songMeta: {
        title:    current.title  || "",
        artist:   current.artist || "",
        genre:    current.category || "",
      },
    });
  }, [currentUser, current]);

  // Initialize/replace the YouTube player
  const initPlayer = useCallback((videoId) => {
    if (!containerRef.current) return;

    // Destroy the old player gracefully
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch(e) {}
      playerRef.current = null;
      isReadyRef.current = false;
    }

    // Create a placeholder div for the player to mount into
    const mountId = "yt-player-mount";
    let mount = document.getElementById(mountId);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = mountId;
      containerRef.current.appendChild(mount);
    }

    playerRef.current = new window.YT.Player(mountId, {
      height: "1",
      width: "1",
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        playsinline: 1,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          isReadyRef.current = true;
          if (isPlaying) event.target.playVideo();
          else event.target.pauseVideo();
          startProgressLoop();
          // Log "play" event when track actually starts
          playStartRef.current = Date.now();
          logEvent("play");
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            // Capture song duration when first playing
            try { songDurRef.current = event.target.getDuration() || 0; } catch(e) {}
          }
          if (event.data === window.YT.PlayerState.ENDED) {
            // Log "complete" before moving to next
            logEvent("complete");
            stopProgressLoop();
            playNext();
          }
        },
        onError: (event) => {
          console.warn("YT Player error, skipping:", event.data);
          logEvent("skip");
          playNext();
        }
      }
    });
  }, [isPlaying, logEvent]);

  // Progress tracking loop
  const startProgressLoop = useCallback(() => {
    stopProgressLoop();
    timerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || !isReadyRef.current) return;
      try {
        const cur = p.getCurrentTime() || 0;
        const dur = p.getDuration() || 0;
        if (dur > 0) {
          setPlayerTime(cur, dur);
          if ("mediaSession" in navigator && navigator.mediaSession.playbackState === "playing") {
            try {
              navigator.mediaSession.setPositionState({
                duration: dur,
                playbackRate: 1,
                position: Math.min(cur, dur),
              });
            } catch(e) {}
          }
        }
      } catch(e) {}
    }, 500);
  }, []);

  const stopProgressLoop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Seek listener support
  useEffect(() => {
    setSeekListener((time) => {
      if (playerRef.current && isReadyRef.current) {
        playerRef.current.seekTo(time, true);
      }
    });
    return () => setSeekListener(() => {});
  }, []);

  // Load new video when track changes
  useEffect(() => {
    if (!current?.id) return;
    const videoId = normalizeId(current.id);

    loadYTApi().then(() => {
      if (lastVideoIdRef.current !== videoId) {
        lastVideoIdRef.current = videoId;
        initPlayer(videoId);
      }
    });
  }, [current?.id]);

  // Control play/pause on isPlaying changes
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !isReadyRef.current) return;
    if (isPlaying) {
      p.playVideo();
      startProgressLoop();
    } else {
      p.pauseVideo();
      stopProgressLoop();
    }
  }, [isPlaying]);

  // MediaSession metadata + handlers
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: current.title || "Unknown Title",
      artist: current.artist || "Unknown Artist",
      album: current.album || "Melopra",
      artwork: [
        { src: current.image || "/default_cover.png", sizes: "512x512", type: "image/png" },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => { if (!isPlaying) togglePlay(); });
    navigator.mediaSession.setActionHandler("pause", () => { if (isPlaying) togglePlay(); });
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);

    return () => {
      ["play","pause","previoustrack","nexttrack"].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch(e) {}
      });
    };
  }, [current, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressLoop();
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e) {} }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: 0,
        left: "-9999px",
        width: 1,
        height: 1,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
