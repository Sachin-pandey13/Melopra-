import InteractiveItem from "./InteractiveItem";

export default function VerticalList({
  items = [],
  actions,
  nowPlayingId, // ✅ NEW
}) {
  if (!actions) return null;

  const { play, addToQueue, toggleLike, addToPlaylist } = actions;

  return (
    <div style={{ padding: "0 16px" }} data-allow-swipe="true">
      {items.map((item) => {
        const isNowPlaying = item.id === nowPlayingId;

        return (
          <InteractiveItem
            key={item.id}
            item={item}
            onPress={play}
            onSwipeRight={addToQueue}
            onSwipeLeft={toggleLike}
            onLongPress={addToPlaylist}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                opacity: isNowPlaying ? 0.85 : 1,
              }}
            >
              {/* THUMB */}
              <img
                src={item.image}
                alt={item.title}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  objectFit: "cover",
                }}
              />

              {/* META */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {item.title}

                  {isNowPlaying && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: "#1db954",
                        color: "#000",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      NOW PLAYING
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.artist}
                </div>
              </div>
            </div>
          </InteractiveItem>
        );
      })}
    </div>
  );
}
