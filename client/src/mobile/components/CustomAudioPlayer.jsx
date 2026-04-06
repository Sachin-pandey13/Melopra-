import { useEffect, useRef } from "react";
import { useNowPlaying, playNext, normalizeId, playPrevious, togglePlay } from "../state/useNowPlaying";
import { setPlayerTime, setSeekListener } from "../state/usePlayerTime";
import { logUserEvent } from "../../api/logUserEvent";
import { auth } from "../../firebase";

const SERVER_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === "localhost" ? "http://localhost:4000" : "https://melopra-backend.onrender.com");

export default function CustomAudioPlayer() {
  const { current, isPlaying } = useNowPlaying();

  const audioRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const currentRef = useRef(current);

  // Sync current ref safely for closures
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // Audio Setup and Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;
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
    };

    const onEnded = () => {
      const track = currentRef.current;
      logUserEvent({
        userId: auth.currentUser?.uid || "guest_user",
        songId: track?.id || lastVideoIdRef.current,
        event: "complete",
        playDuration: audio.duration || 0,
        songDuration: audio.duration || 0,
        songMeta: {
          title: track?.title || "",
          artist: track?.artist || "",
          language: track?.language || track?.lang || track?.genre || "",
          genre: track?.genre || "",
        }
      });
      playNext();
    };

    const onError = (e) => {
      console.warn("Audio stream error, skipping:", e);
      playNext();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Track changed -> Load new stream
  useEffect(() => {
    if (!current?.id || !audioRef.current) return;
    const videoId = normalizeId(current.id);

    if (lastVideoIdRef.current !== videoId) {
      lastVideoIdRef.current = videoId;
      
      const streamUrl = `${SERVER_URL}/api/stream?id=${videoId}`;
      audioRef.current.src = streamUrl;
      audioRef.current.load();
      
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn("Auto-play prevented", e));
      }
    }
  }, [current?.id]);

  // Play/Pause toggler
  useEffect(() => {
    if (!audioRef.current || !audioRef.current.src) return;
    if (isPlaying) {
      audioRef.current.play().then(() => {
        const track = currentRef.current;
        logUserEvent({
          userId: auth.currentUser?.uid || "guest_user",
          songId: track?.id || lastVideoIdRef.current,
          event: "play",
          playDuration: 0,
          songDuration: audioRef.current?.duration || 0,
          songMeta: {
            title: track?.title || "",
            artist: track?.artist || "",
            language: track?.language || track?.lang || track?.genre || "",
            genre: track?.genre || "",
          }
        });
      }).catch(e => console.warn("Play prevented:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Seek listener
  useEffect(() => {
    setSeekListener((time) => {
      if (audioRef.current && !isNaN(audioRef.current.duration)) {
        audioRef.current.currentTime = time;
      }
    });
    return () => setSeekListener(() => {});
  }, []);

  // MediaSession Metadata & Lock-screen integrations
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

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
       if (audioRef.current && details.seekTime !== undefined) {
         audioRef.current.currentTime = details.seekTime;
       }
    });

    return () => {
      ["play","pause","previoustrack","nexttrack","seekto"].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch(e) {}
      });
    };
  }, [current]);

  return (
    <audio 
      ref={audioRef} 
      id="melopra-native-audio" 
      preload="auto" 
      style={{ display: "none" }} 
    />
  );
}
