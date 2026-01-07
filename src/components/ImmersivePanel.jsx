import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LiveAlbumArt from "./LiveAlbumArt";
import SongProgressBar from "./SongProgressBar";
import PlayPauseButton from "./PlayPauseButton";
import WaveformVisualizer from "./WaveformVisualizer";
import YouTube from "react-youtube";
import "../styles/LiveAlbumArt.css";

export default function ImmersivePanel({
  audioRef,
  isPlaying,
  onPlayPause,
  selectedAlbum,
  albumList,
  onAlbumSelect,
  panelGlowColor = "rgba(168, 85, 247, 0.4)",
  canvasVideo,
}) {
  const [view, setView] = useState("lyrics");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [ytPlayer, setYtPlayer] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const videoContainerRef = useRef(null);

  // --- Handle prev/next song ---
  const currentIndex = albumList.findIndex((a) => a.id === selectedAlbum?.id);
  const playPrev = () => {
    const prev =
      albumList[(currentIndex - 1 + albumList.length) % albumList.length];
    onAlbumSelect(prev);
  };
  const playNext = () => {
    const next = albumList[(currentIndex + 1) % albumList.length];
    onAlbumSelect(next);
  };

  // --- Sync lyrics ---
  useEffect(() => {
    if (!audioRef.current || !selectedAlbum?.lyrics) return;
    const updateLyric = () => {
      const currentTime = audioRef.current.currentTime;
      const idx = selectedAlbum.lyrics.findIndex((line, i) => {
        const nextTime = selectedAlbum.lyrics[i + 1]?.time ?? Infinity;
        return currentTime >= line.time && currentTime < nextTime;
      });
      if (idx !== -1 && idx !== currentLineIndex) setCurrentLineIndex(idx);
    };
    const interval = setInterval(updateLyric, 500);
    return () => clearInterval(interval);
  }, [audioRef, selectedAlbum, currentLineIndex]);

  // --- Resume audio if tab hidden ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isPlaying &&
        audioRef.current
      ) {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPlaying]);

  // --- Extract YouTube ID ---
  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };
  const videoId = getYouTubeId(canvasVideo);

  // ✅ --- Fixed YouTube Player Logic ---
  const handleReady = (e) => {
    const player = e.target;
    setYtPlayer(player);
    setVideoReady(true);
    player.mute();

    // ensure full-length video (not 3 sec embed preview)
    player.cueVideoById({
      videoId,
      startSeconds: 0,
    });
  };

  useEffect(() => {
    if (!ytPlayer || !videoReady) return;

    try {
      if (isPlaying) {
        ytPlayer.playVideo();
      } else {
        ytPlayer.pauseVideo();
      }
    } catch (err) {
      console.warn("🎥 YouTube sync error:", err.message);
    }
  }, [isPlaying, ytPlayer, videoReady]);

  // --- Keep video in sync with audio time ---
  useEffect(() => {
    if (!ytPlayer || !audioRef.current || !videoReady) return;

    const interval = setInterval(() => {
      const aTime = audioRef.current.currentTime;
      const vTime = ytPlayer.getCurrentTime?.() || 0;
      if (Math.abs(aTime - vTime) > 2 && aTime > 2) ytPlayer.seekTo(aTime, true);

    }, 3000);

    return () => clearInterval(interval);
  }, [ytPlayer, videoReady]);

  // --- Autoplay/resume on view change ---
  useEffect(() => {
    if (view === "video" && ytPlayer && videoReady) {
      const currentTime = audioRef.current?.currentTime || 0;
      ytPlayer.seekTo(currentTime, true);
      if (isPlaying) ytPlayer.playVideo();
    }
  }, [view, ytPlayer, videoReady, isPlaying]);

  // --- Play full video; no looping ---
  const handleEnd = () => {
    if (ytPlayer && isPlaying) {
      ytPlayer.stopVideo();
    }
  };

  // 🧠 --- Fix: Use full watch URL, not embed link ---
  // Make sure in App.jsx you pass: `https://www.youtube.com/watch?v=${videoId}`
  // Not an `/embed/` link with `start`/`end` params.

  return (
    <div
      className={`relative w-full h-full text-white overflow-hidden transition-all duration-700 ${
        view === "video" ? "bg-black" : ""
      }`}
      style={{
        position: "relative",
        height: "100%",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 🎥 YouTube Background (Full Video, Not Loop) */}
      <div
        ref={videoContainerRef}
        className={`absolute inset-0 overflow-hidden rounded-xl z-0 transition-opacity duration-700 ${
          view === "video" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
        }}
      >
        {videoId && (
          <YouTube
            videoId={videoId}
            opts={{
              playerVars: {
                autoplay: 0,
                controls: 0,
                mute: 1,
                loop: 0,
                rel: 0,
                modestbranding: 1,
                // 🚫 no "playlist" or "end" params (caused 3-sec loop)
              },
            }}
            onReady={handleReady}
            onEnd={handleEnd}
            className="absolute top-0 left-0 w-full h-full"
            iframeClassName="w-full h-full"
          />
        )}

        {/* Overlay for readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.6) 80%)",
            zIndex: 2,
          }}
        />
      </div>

      {/* 💫 Info Section */}
      <div
        className={`relative z-20 flex flex-col items-center justify-center gap-4 transition-all duration-700 ${
          view === "video"
            ? "opacity-0 translate-y-10"
            : "opacity-100 translate-y-0"
        }`}
      >
        <LiveAlbumArt
          audioRef={audioRef}
          isPlaying={isPlaying}
          onPlay={onPlayPause}
          album={selectedAlbum}
          mode="active"
        />
        <WaveformVisualizer isPlaying={isPlaying} glowColor={panelGlowColor} />
        <div className="text-center mt-2">
          <h3 className="text-xl font-bold text-purple-300">
            {selectedAlbum?.title}
          </h3>
          <p className="text-md text-gray-300">{selectedAlbum?.artist}</p>
        </div>
      </div>

      {/* 🎚 Controls */}
      <div
        className={`relative z-30 w-full px-2 transition-all duration-700 ${
          view === "video"
            ? "absolute bottom-6 left-0 flex flex-col items-center"
            : "mt-4 flex flex-col items-center"
        }`}
      >
        <SongProgressBar audioRef={audioRef} isPlaying={isPlaying} />
        <div className="flex justify-center items-center mt-4 gap-4">
          <button
            onClick={playPrev}
            className="rounded-full bg-[#444] px-4 py-2 text-white hover:bg-[#00ffc3] hover:text-black"
          >
            ⏮ Prev
          </button>
          <PlayPauseButton
            isPlaying={isPlaying}
            audioRef={audioRef}
            onPlayPause={onPlayPause}
          />
          <button
            onClick={playNext}
            className="rounded-full bg-[#444] px-4 py-2 text-white hover:bg-[#00ffc3] hover:text-black"
          >
            Next ⏭
          </button>
        </div>
      </div>

      {/* 🧭 View Toggle */}
      <div
        className={`z-40 flex gap-4 text-sm font-medium transition-all duration-700 ${
          view === "video"
            ? "absolute bottom-2 left-1/2 -translate-x-1/2"
            : "relative mt-6"
        }`}
      >
        <button
          onClick={() => setView("lyrics")}
          className={`px-3 py-1 rounded-full ${
            view === "lyrics"
              ? "bg-purple-500 text-white"
              : "bg-white/10 text-purple-200"
          }`}
        >
          📝 Lyrics
        </button>
        <button
          onClick={() => setView("video")}
          className={`px-3 py-1 rounded-full ${
            view === "video"
              ? "bg-purple-500 text-white"
              : "bg-white/10 text-purple-200"
          }`}
        >
          📺 Video
        </button>
      </div>

      {/* 📝 Lyrics Panel */}
      <AnimatePresence mode="wait">
        {view === "lyrics" && (
          <motion.div
            key="lyrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-x-0 bottom-0 top-1/2 overflow-y-auto px-6"
          >
            <div className="text-purple-200 text-sm space-y-2 max-h-60 overflow-y-auto">
              {selectedAlbum?.lyrics?.map((line, index) => (
                <p
                  key={index}
                  className={`text-center transition-all duration-300 ${
                    index === currentLineIndex
                      ? "text-white text-lg font-bold scale-105"
                      : "text-purple-400 opacity-50"
                  }`}
                >
                  {line.line}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
