import { useEffect, useRef, useState } from "react";
import { useNowPlaying, playNext, normalizeId } from "../state/useNowPlaying";
import { loadYouTubeAPI } from "../utils/loadYouTubeAPI";

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
          onReady: () => setReady(true),
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

  return <div id="yt-audio" style={{ display: "none" }} />;
}
