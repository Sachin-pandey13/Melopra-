import { useEffect } from "react";

export default function usePlayerController({
  audioRef,
  youtubePlayerRef,
  selectedAlbum,
  setIsPlaying,
  playNext,
}) {
  // ▶️ Play / Pause toggle
  const playPause = () => {
    if (!selectedAlbum) return;

    const audio = audioRef.current;
    const yt = youtubePlayerRef.current;

    if (selectedAlbum.category === "YouTube" && yt) {
      if (yt.getPlayerState?.() === 1) {
        yt.pauseVideo();
        setIsPlaying(false);
      } else {
        yt.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(console.warn);
    }
  };

  // ⏸ Hard pause
  const pause = () => {
    const yt = youtubePlayerRef.current;
    const audio = audioRef.current;

    if (yt?.pauseVideo) {
      yt.pauseVideo();
      setIsPlaying(false);
      return;
    }

    if (audio && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  // ▶️ Resume
  const resume = () => {
    const yt = youtubePlayerRef.current;
    const audio = audioRef.current;

    if (yt?.playVideo) {
      yt.playVideo();
      setIsPlaying(true);
      return;
    }

    if (audio && audio.paused) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(console.warn);
    }
  };

  // ⏩ Seek
  const seek = (value) => {
    const yt = youtubePlayerRef.current;
    const audio = audioRef.current;

    if (selectedAlbum?.category === "YouTube" && yt?.getDuration) {
      const duration = yt.getDuration();
      if (!isNaN(duration)) {
        yt.seekTo(duration * value, true);
      }
      return;
    }

    if (audio?.duration && !isNaN(audio.duration)) {
      audio.currentTime = audio.duration * value;
    }
  };

  // 🔁 Native audio end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnd = () => playNext();
    audio.addEventListener("ended", onEnd);

    return () => audio.removeEventListener("ended", onEnd);
  }, [playNext]);

  // 🔁 YouTube end
  const onYouTubeEnd = () => {
    playNext();
  };

  // 📊 Progress bar updater
  useEffect(() => {
    const interval = setInterval(() => {
      const yt = youtubePlayerRef.current;
      const audio = audioRef.current;

      if (selectedAlbum?.category === "YouTube" && yt?.getCurrentTime) {
        const current = yt.getCurrentTime();
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

  return {
    playPause,
    pause,
    resume,
    seek,
    onYouTubeEnd,
  };
}
