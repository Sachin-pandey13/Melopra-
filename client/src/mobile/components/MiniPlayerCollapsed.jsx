import {
  useNowPlaying,
  togglePlay,
  openPlayer,
} from "../state/useNowPlaying";
import { usePlayerTime } from "../state/usePlayerTime";

function MiniProgressBar() {
  const { currentTime, duration } = usePlayerTime();
  const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <div 
      style={{
        position: "absolute",
        bottom: 0,
        left: 12,
        right: 12,
        height: 2,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 2,
        overflow: "hidden"
      }}
    >
      <div 
        style={{
          height: "100%",
          backgroundColor: "#fff",
          width: `${percentage}%`,
          transition: "width 0.5s linear"
        }}
      />
    </div>
  );
}

export default function MiniPlayerCollapsed() {
  const { current, isPlaying, isSmartLoading } = useNowPlaying();

  if (!current) return null;

  return (
    <div
      onClick={openPlayer}
      style={{
        position: "fixed",
        bottom: 64, // Just above the nav
        left: "2%",
        right: "2%",
        width: "96%",
        height: 60,
        background: "rgba(30, 30, 30, 0.7)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        zIndex: 50,
        cursor: "pointer",
        transition: "transform 0.2s ease",
      }}
      className="active:scale-[0.98]"
    >
      <img
        src={current.image}
        alt=""
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          objectFit: "cover",
        }}
      />

      <div style={{ flex: 1, marginLeft: 12, overflow: "hidden" }}>
        {isSmartLoading ? (
          <div
            style={{
              color: "#1DB954",
              fontWeight: 700,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className="animate-pulse">●</span> Smart Fetching...
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {current.title}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {current.artist}
            </div>
          </>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: 14,
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 8,
        }}
        className="active:scale-90 transition-transform"
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      {/* Mini Progress Bar Overlay */}
      <MiniProgressBar />

    </div>
  );
}
