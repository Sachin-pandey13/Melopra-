import { useEffect, useRef, useState } from 'react';

export default function SongProgressBar({ audioRef }) {
  const progressRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipTime, setTooltipTime] = useState(0);
  const [hoverX, setHoverX] = useState(0);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (!isDragging) {
        setProgress((audio.currentTime / audio.duration) * 100 || 0);
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
    };
  }, [audioRef, isDragging]);

  const handleSeek = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = offsetX / rect.width;
    const newTime = percent * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(percent * 100);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e) => {
    if (!progressRef.current || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.min(Math.max(offsetX / rect.width, 0), 1);
    setHoverX(offsetX);
    setTooltipTime(percent * audioRef.current.duration);

    if (isDragging) {
      audioRef.current.currentTime = percent * audioRef.current.duration;
      setProgress(percent * 100);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full flex justify-center mt-4">
      <div
        ref={progressRef}
        className="relative w-full max-w-md h-3 bg-gray-700 rounded-lg cursor-pointer group"
        onClick={handleSeek}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
      >
        {/* Filled progress */}
        <div
          className="h-full bg-purple-500 rounded-lg"
          style={{ width: `${progress}%` }}
        />

        {/* Progress circle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-purple-400 border-2 border-white"
          style={{ left: `calc(${progress}% - 8px)` }}
        />

        {/* Tooltip */}
        <div
          className="absolute -top-8 left-0 px-2 py-1 text-sm bg-black bg-opacity-80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ transform: `translateX(${hoverX}px)` }}
        >
          {formatTime(tooltipTime)}
        </div>
      </div>
    </div>
  );
}
