export default function MobileTopBar({
  title,
  back,
  search,
  query,
  onQueryChange,
  placeholder = "Search songs, artists...",
}) {
  return (
    <div
      className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
      style={{
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {back && (
        <button
          className="text-lg"
          style={{ opacity: 0.9 }}
        >
          ←
        </button>
      )}

      {/* 🔍 SEARCH MODE */}
      {search ? (
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.08)",
            border: "none",
            color: "white",
            outline: "none",
            fontSize: 14,
          }}
        />
      ) : (
        /* 🏷 TITLE MODE */
        <h1
          className="text-lg font-semibold"
          style={{ opacity: 0.95 }}
        >
          {title}
        </h1>
      )}
    </div>
  );
}
