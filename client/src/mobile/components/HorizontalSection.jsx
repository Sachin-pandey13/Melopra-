import InteractiveItem from "./InteractiveItem";

export default function HorizontalSection({
  title,
  subtitle,
  items = [],
  loading = false,
  actions,
  type = "default", // default | card | square
}) {
  // ✅ DO NOT early-return (this was killing interaction)
  const play = actions?.play;
  const addToQueue = actions?.addToQueue;
  const toggleLike = actions?.toggleLike;
  const addToPlaylist = actions?.addToPlaylist;

  return (
    <div style={{ padding: "16px 0 8px 16px" }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{title}</h3>
        {subtitle && (
          <p style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{subtitle}</p>
        )}
      </div>

      <div 
        className="hide-scrollbar"
        style={{ 
          display: "flex", 
          gap: 16, 
          overflowX: "auto",
          touchAction: "pan-x",
          paddingBottom: 8,
          scrollbarWidth: "none", 
          msOverflowStyle: "none" 
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; }` }} />
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 120,
                height: 120,
                borderRadius: 12,
                background: "#1a1a1a",
                flexShrink: 0,
              }}
            />
          ))}

        {!loading && items.length === 0 && (
           <div style={{ 
              width: "calc(100vw - 32px)", 
              height: 100, 
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.4,
              fontSize: 13
           }}>
              No content found
           </div>
        )}

        {!loading &&
          items.map((item) => (
            <InteractiveItem
              key={item.id}
              item={item}
              noSwipe={true}
              onPress={() => {
                if (item.onPlay) item.onPlay();
                else play(item);
              }}
              onSwipeRight={addToQueue}
              onSwipeLeft={toggleLike}
              onLongPress={addToPlaylist}
            >
              <div style={{ 
                width: type === "card" ? 220 : 130, 
                flexShrink: 0,
              }}>
                <div
                  style={{
                    width: "100%",
                    height: type === "card" ? 120 : 130,
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                    background: "#1a1a1a",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const container = e.target.parentElement;
                      container.style.background = 'linear-gradient(135deg, #FF007A 0%, #1a1a1a 100%)';
                      container.innerHTML = `
                        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:10px;">
                          <div style="font-size:32px;margin-bottom:4px;">🎵</div>
                          <div style="font-size:10px;font-weight:bold;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">
                            ${item.title.split(' ')[0]}
                          </div>
                        </div>
                      `;
                    }}
                  />
                </div>
                <p 
                  style={{ 
                    fontSize: 13, 
                    marginTop: 12, 
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "white"
                  }}
                >
                  {item.title}
                </p>
                <p 
                  style={{ 
                    fontSize: 11, 
                    opacity: 0.5,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: 2,
                    fontWeight: 500
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
