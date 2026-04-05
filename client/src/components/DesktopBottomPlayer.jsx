import React from 'react';
import SongProgressBar from './SongProgressBar';
import PlayPauseButton from './PlayPauseButton';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';

export default function DesktopBottomPlayer({
  selectedAlbum,
  isPlaying,
  audioRef,
  youtubePlayerRef,   // ← NEW: needed for YouTube progress tracking
  onPlayPause,
  onNext,
  onPrev,
  isImmersiveVisible,
  toggleImmersive,
}) {
  if (!selectedAlbum) return null;

  return (
    <div
      className="w-full h-[90px] bg-[#0b0b0f] border-t border-white/10 flex items-center justify-between px-6 z-50 cursor-pointer hover:bg-[#15151a] transition-all shrink-0"
      onClick={toggleImmersive}
    >
      {/* Track Info */}
      <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
        <img
          src={selectedAlbum.image || selectedAlbum.thumbnail || selectedAlbum.cover}
          alt="album art"
          className="w-14 h-14 rounded-md object-cover shadow-lg"
        />
        <div className="overflow-hidden whitespace-nowrap">
          <p className="text-white text-sm font-bold truncate max-w-[200px]">{selectedAlbum.title}</p>
          <p className="text-gray-400 text-xs truncate max-w-[200px]">{selectedAlbum.artist}</p>
        </div>
      </div>

      {/* Centre: controls + progress bar */}
      <div
        className="flex flex-col items-center justify-center flex-grow max-w-2xl px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Playback buttons */}
        <div className="flex items-center gap-6 mb-2">
          <button 
            type="button"
            className="text-gray-400 hover:text-white transition" 
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.05-5.36a.7.7 0 0 1 1.05.6v11.82a.7.7 0 0 1-1.05.6L4 9.15v5.15a.7.7 0 0 1-1.4 0V1.7a.7.7 0 0 1 .7-.7z" />
            </svg>
          </button>

          <PlayPauseButton isPlaying={isPlaying} onPlayPause={onPlayPause} audioRef={audioRef} />

          <button 
            type="button"
            className="text-gray-400 hover:text-white transition" 
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.95 1.49A.7.7 0 0 0 1.9 2.1v11.8a.7.7 0 0 0 1.05.6l9.05-5.36v5.16a.7.7 0 0 0 1.4 0V1.7a.7.7 0 0 0-.7-.7z" />
            </svg>
          </button>
        </div>

        {/* Progress bar — now aware of YouTube player */}
        <div className="w-full">
          <SongProgressBar
            audioRef={audioRef}
            youtubePlayerRef={youtubePlayerRef}
            selectedAlbum={selectedAlbum}
          />
        </div>
      </div>

      {/* Right: immersive toggle */}
      <div className="w-1/4 flex justify-end min-w-[200px]">
        <button
          className="text-gray-400 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); toggleImmersive(); }}
          title={isImmersiveVisible ? 'Collapse player' : 'Expand player'}
        >
          {isImmersiveVisible ? <FaChevronDown size={20} /> : <FaChevronUp size={20} />}
        </button>
      </div>
    </div>
  );
}
