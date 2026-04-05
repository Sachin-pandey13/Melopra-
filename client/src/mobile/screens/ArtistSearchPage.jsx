import { useState, useEffect } from "react";

const API = "https://melopra-backend.onrender.com";

/* ---------- Deezer Artist Search ---------- */
async function searchDeezerArtists(query) {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `${API}/api/deezer-artist?artist=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.artists) return [];

    return data.artists.map((artist) => {
      return {
        id: `deezer-${artist.id}`,
        name: artist.name,
        image: artist.image || "",
        channelId: `deezer-${artist.id}`,
        fans: artist.fans || 0,
      };
    });
  } catch (err) {
    console.warn("Deezer search failed:", err);
    return [];
  }
}

function getProxiedImage(url) {
  if (!url) return "";
  if (url.includes("wsrv.nl") || !url.includes("dzcdn.net")) return url;
  const cleanUrl = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${cleanUrl}&w=200&h=200&fit=cover&mask=circle`;
}

export default function ArtistSearchPage({ onFollow, isFollowing, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const artists = await searchDeezerArtists(query);
      setResults(artists);
      setLoading(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: "12px 16px",
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={() => {
            onClose();
          }}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "white",
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            cursor: "pointer",
            flexShrink: 0,
          }}
          className="active:scale-90 transition-transform"
        >
          ←
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists..."
          autoFocus
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "white",
            outline: "none",
            fontSize: 14,
          }}
        />
      </div>

      {/* Results */}
      <div style={{ padding: "8px 0" }}>
        {loading && (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: "3px solid rgba(255,255,255,0.1)",
                borderTop: "3px solid white",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto",
              }}
            />
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <p style={{ padding: "20px 16px", opacity: 0.5, fontSize: 13, textAlign: "center" }}>
            No artists found for "{query}"
          </p>
        )}

        {!loading && !query.trim() && (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🎤</p>
            <p style={{ opacity: 0.5, fontSize: 14 }}>
              Search for your favorite artists
            </p>
            <p style={{ opacity: 0.35, fontSize: 12, marginTop: 4 }}>
              powered by Deezer
            </p>
          </div>
        )}

        {results.map((artist) => {
          const following = isFollowing(artist.id);

          return (
            <div
              key={artist.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                cursor: "pointer",
              }}
              className="active:bg-white/5 transition-colors"
            >
              {/* Artist image */}
              {artist.image ? (
                <img
                  src={getProxiedImage(artist.image)}
                  alt={artist.name}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "2px solid rgba(255,255,255,0.1)",
                  }}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    border: "2px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  🎤
                </div>
              )}

              {/* Name + fans */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {artist.name}
                </p>
                {artist.fans > 0 && (
                  <p style={{ fontSize: 12, opacity: 0.5 }}>
                    {formatFans(artist.fans)} fans
                  </p>
                )}
              </div>

              {/* Follow button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFollow(artist);
                }}
                style={{
                  padding: "7px 18px",
                  borderRadius: 20,
                  border: following
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "none",
                  background: following
                    ? "transparent"
                    : "linear-gradient(135deg, #1DB954, #1ed760)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                className="active:scale-95 transition-transform"
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Spin animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`,
        }}
      />
    </div>
  );
}

function formatFans(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}
