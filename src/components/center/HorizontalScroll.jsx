import React, { useRef } from "react";

const HorizontalScroll = ({ title, items = [], onPlay }) => {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = 400;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="bg-black/50 hover:bg-purple-600 rounded-full p-2"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scroll("right")}
            className="bg-black/50 hover:bg-purple-600 rounded-full p-2"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>

      {/* Scrollable Row */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x"
      >
        {items.length > 0 ? (
          items.map((item, index) => {
            // ✅ Section-scoped unique key (FIXES WARNING PERMANENTLY)
            const key = `${title}-${item.id || item.videoId || "item"}-${index}`;

            return (
              <div
                key={key}
                className="flex-none w-[180px] md:w-[200px] cursor-pointer snap-start"
                onClick={() => onPlay?.(item)}
              >
                <div className="rounded-xl overflow-hidden relative group">
                  <img
                    src={item.image}
                    alt={item.title || "track-image"}
                    className="w-full h-[120px] md:h-[140px] object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex justify-center items-center text-white text-xl font-bold transition-opacity">
                    ▶
                  </div>
                </div>

                {/* Text Content */}
                <p className="mt-2 text-sm font-medium truncate">
                  {item.title || "Unknown Title"}
                </p>
                <p className="text-xs opacity-70 truncate">
                  {item.artist || "Unknown Artist"}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-gray-500 text-sm">No items available</p>
        )}
      </div>
    </div>
  );
};

export default HorizontalScroll;
