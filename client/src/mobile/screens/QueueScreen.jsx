import { useNowPlaying, playFromQueue, removeFromQueue } from "../state/useNowPlaying";
import MobileTopBar from "../components/MobileTopBar";

export default function QueueScreen() {
  const { queue } = useNowPlaying();

  return (
    <div>
      <MobileTopBar title="Up Next" showBack />

      {queue.length === 0 ? (
        <p style={{ padding: 16, opacity: 0.6 }}>
          Queue is empty
        </p>
      ) : (
        queue.map((item, index) => (
          <div
            key={item.id + index}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={item.image}
              alt={item.title}
              style={{
                width: 44,
                height: 44,
                borderRadius: 6,
                marginRight: 12,
              }}
            />

            <div
              style={{ flex: 1, overflow: "hidden" }}
              onClick={() => playFromQueue(index)}
            >
              <div
                style={{
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {item.artist}
              </div>
            </div>

            <button
              onClick={() => removeFromQueue(index)}
              style={{
                background: "none",
                border: "none",
                color: "#ff4d4d",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
