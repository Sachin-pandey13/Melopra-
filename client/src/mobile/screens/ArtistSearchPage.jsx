import { useState, useEffect } from "react";

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Ccircle cx='28' cy='28' r='28' fill='%23333'/%3E%3Ctext x='28' y='36' text-anchor='middle' font-size='28' fill='%23888'%3E🎤%3C/text%3E%3C/svg%3E";

// Both in dev (Vite proxy) and production (Vercel rewrites), /api/* is forwarded
// to the Render backend — so we always use relative paths.
const BASE_URL = "";

/* ---------- Deezer Artist Search via JSONP (Bypasses Backend/CORS) ---------- */
function searchDeezerArtists(query) {
  return new Promise((resolve) => {
    if (!query || query.trim().length < 2) return resolve([]);

    const callbackName = 'deezer_cb_' + Math.round(1000000 * Math.random());
    
    // Setup JSONP callback
    window[callbackName] = function(data) {
      cleanup();
      if (!data || !data.data || !data.data.length) return resolve([]);

      // Map results
      const results = data.data.map((artist) => ({
        id: `deezer-${artist.id}`,
        name: artist.name,
        // Route image through weserv to bypass Deezer CDN browser blocks
        image: `https://images.weserv.nl/?url=api.deezer.com/artist/${artist.id}/image&default=https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png`,
        channelId: `deezer-${artist.id}`,
        fans: artist.nb_fan || 0,
      }));
      resolve(results);
    };

    const script = document.createElement('script');
    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(query.trim())}&output=jsonp&callback=${callbackName}`;
    script.referrerPolicy = "no-referrer"; // Hide origin from Cloudflare
    
    // Timeout or error
    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      if (window[callbackName]) delete window[callbackName];
      if (document.body.contains(script)) document.body.removeChild(script);
    }

    document.body.appendChild(script);
  });
}

// Images are pre-proxied via weserv above, so we just return the url
function getProxiedImage(url) {
  if (!url) return PLACEHOLDER_IMG;
  return url;
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
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "2px solid rgba(255,255,255,0.1)",
                  }}
                  referrerPolicy="no-referrer"
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
