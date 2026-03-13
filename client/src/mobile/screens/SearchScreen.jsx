import { useEffect, useState, useMemo } from "react";
import VerticalList from "../components/VerticalList";
import { searchYouTube } from "../utils/searchYouTube";
import { useNowPlaying } from "../state/useNowPlaying";

export default function SearchScreen({ actions }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!actions) return null;

  // 🔑 READ BOTH current + history
  const { current, history } = useNowPlaying();

  // ✅ BUILD RECENTS CORRECTLY
const recent = useMemo(() => {
  const list = [];

  if (current) {
    list.push({ ...current }); // ✅ CLONE
  }

  for (const h of history) {
    if (!list.find(i => i.id === h.id)) {
      list.push({ ...h }); // ✅ CLONE
    }
  }

  return list.slice(0, 20);
}, [current, history]);



  // 🔍 SEARCH
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      const yt = await searchYouTube(query);
      setResults(yt);
      setLoading(false);
    }, 400);

    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      {/* SEARCH BAR */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          padding: "12px 16px",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(18px)",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists..."
          style={{
            width: "100%",
            padding: "12px 40px 12px 14px",
            borderRadius: 12,
            background: "#1a1a1a",
            border: "none",
            color: "white",
            outline: "none",
            fontSize: 14,
          }}
        />

        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute",
              right: 28,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "#aaa",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* CONTENT */}
      {query.trim().length === 0 ? (
  <>
    <h4 style={{ padding: "12px 16px", marginBottom: 4 }}>
      Recents
    </h4>

    {recent.length === 0 ? (
      <p
        style={{
          padding: "16px",
          opacity: 0.6,
          fontSize: 13,
        }}
      >
        Your recently played songs will appear here.
      </p>
    ) : (
      <VerticalList
        items={recent}
        actions={actions}
        nowPlayingId={current?.id}
      />
    )}
  </>
) : (
  <VerticalList
    items={results}
    actions={actions}
    loading={loading}
    nowPlayingId={current?.id}
  />
)}
    </div>
  );
}
