import InteractiveItem from "./InteractiveItem";

export default function HorizontalSection({
  title,
  subtitle,
  items = [],
  loading = false,
  actions,
  type = "default", // default | card | square
}) {
  const play = actions?.play;

  return (
    <div style={{ padding: "16px 0 8px 0" }}>

      {/* Section Header */}
      <div style={{ paddingLeft: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{title}</h3>
        {subtitle && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3, marginBottom: 0 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/*
       * ── Horizontal scroll row ──────────────────────────────────────────────
       * WebkitOverflowScrolling: touch  →  iOS momentum / rubber-band scrolling
       * overscrollBehaviorX: contain    →  prevents horizontal swipe from
       *                                    bubbling up to the vertical page scroll
       * NO touchAction override here    →  let children and browser decide
       *   (children have noSwipe=true → touchAction:"auto" → scroll flows freely)
       * ──────────────────────────────────────────────────────────────────────
       */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 12,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 8,
          overflowX: "auto",
          overflowY: "visible",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Skeleton loaders */}
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 130,
                height: 130,
                borderRadius: 12,
                background: "rgba(255,255,255,0.07)",
                flexShrink: 0,
                animation: "pulse 1.5s infinite alternate",
              }}
            />
          ))}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div
            style={{
              width: "calc(100vw - 32px)",
              height: 100,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.4,
              fontSize: 13,
            }}
          >
            No content found
          </div>
        )}

        {/* Cards */}
        {!loading &&
          items.map((item) => (
            <InteractiveItem
              key={item.id}
              item={item}
              noSwipe={true}
              onPress={() => {
                if (item.onPlay) item.onPlay();
                else play?.(item);
              }}
            >
              <div style={{ width: type === "card" ? 200 : 130, flexShrink: 0 }}>
                {/* Thumbnail */}
                <div
                  style={{
                    width: "100%",
                    height: type === "card" ? 120 : 130,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#1a1a1a",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      const c = e.target.parentElement;
                      c.style.background =
                        "linear-gradient(135deg,#FF007A 0%,#1a1a1a 100%)";
                      c.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:10px"><div style="font-size:28px;margin-bottom:4px">🎵</div><div style="font-size:10px;font-weight:700;opacity:0.8;text-transform:uppercase;letter-spacing:1px">${(item.title || "").split(" ")[0]}</div></div>`;
                    }}
                  />
                </div>

                {/* Title */}
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    margin: "8px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </p>

                {/* Artist */}
                <p
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    margin: "2px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: 500,
                  }}
                >
                  {item.subtitle || item.artist || "Recommended"}
                </p>
              </div>
            </InteractiveItem>
          ))}
      </div>
    </div>
  );
}
