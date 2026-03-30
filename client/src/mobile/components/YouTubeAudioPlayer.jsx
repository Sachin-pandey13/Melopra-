import { useEffect, useRef, useState } from "react";
import { useNowPlaying, playNext, normalizeId, playPrevious, togglePlay } from "../state/useNowPlaying";
import { loadYouTubeAPI } from "../utils/loadYouTubeAPI";
import { setPlayerTime, setSeekListener } from "../state/usePlayerTime";

export default function YouTubeAudioPlayer() {
  const { current, isPlaying } = useNowPlaying();

  const playerRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const [ready, setReady] = useState(false);

  // load YT once
  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then((YT) => {
      if (!mounted || playerRef.current) return;

      playerRef.current = new YT.Player("yt-audio", {
        height: "0",
        width: "0",
        playerVars: {
          autoplay: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setReady(true);
            setSeekListener((time) => {
              if (playerRef.current && typeof playerRef.current.seekTo === "function") {
                playerRef.current.seekTo(time, true);
              }
            });
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              playNext();
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !current?.id || !playerRef.current) return;

    const isNewTrack = lastVideoIdRef.current !== current.id;

    if (isNewTrack) {
      lastVideoIdRef.current = current.id;
      const vidId = normalizeId(current.id);
      playerRef.current.loadVideoById(vidId);
    }

    // 🔑 ALWAYS CONTROL PLAY STATE
    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [current, isPlaying, ready]);

  // Set up Media Session Metadata & Actions
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: current.title || "Unknown Title",
      artist: current.artist || "Unknown Artist",
      album: current.album || "Melopra",
      artwork: [
        { src: current.image || "https://melopra.com/default_album_art.png", sizes: "512x512", type: "image/png" },
        { src: current.image || "https://melopra.com/default_album_art.png", sizes: "256x256", type: "image/png" }
      ]
    });

    navigator.mediaSession.setActionHandler("play", () => {
      if (!isPlaying) togglePlay();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (isPlaying) togglePlay();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      playPrevious();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      playNext();
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
         playerRef.current.seekTo(details.seekTime, true);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [current, isPlaying]);

  // Sync time to specialized state store
  useEffect(() => {
    if (!ready || !playerRef.current) return;

    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        try {
          const currentTime = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setPlayerTime(currentTime, dur);
          
          if ("mediaSession" in navigator && dur > 0) {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: playerRef.current.getPlaybackRate() || 1,
              position: currentTime
            });
          }
        } catch(e) {}
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, ready]);

  return <div id="yt-audio" style={{ display: "none" }} />;
}
