import { useEffect, useRef, useState, useCallback } from 'react';

export default function SongProgressBar({ audioRef, youtubePlayerRef, selectedAlbum }) {
  const progressRef = useRef(null);
  const [progress, setProgress]       = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [isDragging, setIsDragging]   = useState(false);
  const [hoverX, setHoverX]           = useState(null);
  const [tooltipTime, setTooltipTime] = useState(0);

  const isYouTube = selectedAlbum?.category?.toLowerCase() === 'youtube';

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ─── Poll every 500 ms — works for both YT iframe and native <audio> ───
  useEffect(() => {
    const tick = () => {
      if (isDragging) return;
      try {
        if (isYouTube) {
          const yt = youtubePlayerRef?.current;
          if (!yt?.getCurrentTime) return;
          const cur = yt.getCurrentTime();
          const dur = yt.getDuration?.() || 0;
          if (dur > 0) {
            setCurrentTime(cur);
            setDuration(dur);
            setProgress((cur / dur) * 100);
          }
        } else {
          const audio = audioRef?.current;
          if (!audio || !audio.duration || isNaN(audio.duration)) return;
          setCurrentTime(audio.currentTime);
          setDuration(audio.duration);
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      } catch (_) {}
    };

    tick(); // run once immediately on song change
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isYouTube, audioRef, youtubePlayerRef, isDragging, selectedAlbum]);

  // ─── Seek ───
  const seekToPercent = useCallback((pct) => {
    const p = Math.min(Math.max(pct, 0), 1);
    try {
      if (isYouTube) {
        const yt = youtubePlayerRef?.current;
        const dur = yt?.getDuration?.() || 0;
        if (dur > 0) yt.seekTo(p * dur, true);
      } else {
        const audio = audioRef?.current;
        if (audio?.duration && !isNaN(audio.duration)) {
          audio.currentTime = p * audio.duration;
        }
      }
    } catch (_) {}
    setProgress(p * 100);
  }, [isYouTube, audioRef, youtubePlayerRef]);

  const pctFromEvent = (e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (e.clientX - rect.left) / rect.width;
  };

  const handleMouseDown = (e) => { setIsDragging(true); seekToPercent(pctFromEvent(e)); };
  const handleMouseMove = (e) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    setHoverX(e.clientX - rect.left);
    setTooltipTime(pctFromEvent(e) * duration);
    if (isDragging) seekToPercent(pctFromEvent(e));
  };
  const handleMouseUp  = (e) => { if (isDragging) seekToPercent(pctFromEvent(e)); setIsDragging(false); };
  const handleClick    = (e) => { if (!isDragging) seekToPercent(pctFromEvent(e)); };

  return (
    <div className="w-full flex flex-col items-center gap-1 select-none">
      {/* Time labels */}
      <div className="w-full flex justify-between text-[11px] text-white/40 px-0.5">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Track */}
      <div
        ref={progressRef}
        className="relative w-full h-[5px] rounded-full bg-white/10 cursor-pointer group"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setHoverX(null); }}
      >
        {/* Filled bar */}
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${progress}%`, transition: isDragging ? 'none' : 'width 0.5s linear' }}
        />

        {/* Thumb dot — visible on hover */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          style={{ left: `calc(${progress}% - 6px)` }}
        />

        {/* Hover tooltip */}
        {hoverX !== null && (
          <div
            className="absolute -top-7 px-2 py-0.5 text-xs bg-black/80 text-white rounded pointer-events-none whitespace-nowrap"
            style={{ left: hoverX, transform: 'translateX(-50%)' }}
          >
            {formatTime(tooltipTime)}
          </div>
        )}
      </div>
    </div>
  );
}
