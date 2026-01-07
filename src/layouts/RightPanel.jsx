import ImmersivePanel from "../components/ImmersivePanel";

export default function RightPanel({
  immersivePanelRef,

  isImmersiveVisible,
  selectedAlbum,

  panelRight,
  panelGlowColor,
  isResizing,

  startResize,

  audioRef,
  videoRef,
  isPlaying,

  player,
  albums,
  handleAlbumSelect,

  albumArtSize,
  canvasVideo,
}) {
  if (!isImmersiveVisible || !selectedAlbum) return null;

  return (
    <>
      {/* Resize Handle */}
      <div
        onMouseDown={(e) => startResize(e, "center-right")}
        style={{
          width: "8px",
          cursor: "col-resize",
          background: isResizing
            ? "rgba(255,255,255,0.04)"
            : "transparent",
          transition: "background 0.15s",
          zIndex: 40,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background =
            "rgba(255,255,255,0.02)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      />

      {/* Right / Immersive Panel */}
      <div
        ref={immersivePanelRef}
        className="relative overflow-hidden transition-all hide-scrollbar"
        style={{
          width: `${panelRight}%`,
          minWidth: "220px",
          maxWidth: "45%",
          height: "100%",
          background: `linear-gradient(120deg, ${
            panelGlowColor || "#ffffff20"
          } 0%, #ffffff08 100%)`,
          boxShadow: `0 0 16px ${panelGlowColor || "#ffffff40"}`,
          borderRadius: "1rem",
          transition: isResizing ? "none" : "width 0.25s ease",
        }}
      >
        <div className="relative z-20 h-full w-full">
          <ImmersivePanel
            audioRef={audioRef}
            videoRef={videoRef}
            isPlaying={isPlaying}
            onPlayPause={player.playPause}
            selectedAlbum={selectedAlbum}
            albumList={albums}
            onAlbumSelect={handleAlbumSelect}
            panelGlowColor={panelGlowColor}
            onNext={player.playNext}
            onSeek={player.seek}
            size={Math.min(520, Math.round(albumArtSize * 1.8))}
            canvasVideo={canvasVideo}
          />
        </div>

        {/* Soft overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.25))",
            zIndex: 10,
          }}
        />
      </div>
    </>
  );
}
