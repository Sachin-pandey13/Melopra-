import { useEffect, useRef, useCallback } from "react";
import { useNowPlaying, playNext, normalizeId, playPrevious, togglePlay } from "../state/useNowPlaying";
import { setPlayerTime, setSeekListener } from "../state/usePlayerTime";
import { logUserEvent } from "../../api/logUserEvent";
import { auth } from "../../firebase";

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

  const playerRef = useRef(null);  // YT.Player instance
  const containerRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const isReadyRef = useRef(false);
  const timerRef = useRef(null);

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
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            logUserEvent({
              userId: auth.currentUser?.uid || "guest_user",
              songId: current?.id || videoId,
              event: "complete",
              playDuration: event.target.getDuration() || 0,
              songDuration: event.target.getDuration() || 0,
              songMeta: {
                title: current?.title || "",
                artist: current?.artist || "",
                language: current?.language || current?.lang || current?.genre || "",
                genre: current?.genre || "",
              }
            });
            stopProgressLoop();
            playNext();
          }
        },
        onError: (event) => {
          console.warn("YT Player error, skipping:", event.data);
          playNext();
        }
      }
    });
  }, [isPlaying]);

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
      logUserEvent({
        userId: auth.currentUser?.uid || "guest_user",
        songId: current?.id || lastVideoIdRef.current,
        event: "play",
        playDuration: 0,
        songDuration: p.getDuration() || 0,
        songMeta: {
          title: current?.title || "",
          artist: current?.artist || "",
          language: current?.language || current?.lang || current?.genre || "",
          genre: current?.genre || "",
        }
      });
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
