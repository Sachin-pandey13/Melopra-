import React, { useEffect, useState } from "react";
import { fetchTracksFromPlaylist } from "../../utils/FirestorePlaylists";

function getProxiedImage(url) {
  if (!url) return "";
  if (url.includes("wsrv.nl") || !url.includes("dzcdn.net")) return url;
  const cleanUrl = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${cleanUrl}&w=200&h=200&fit=cover`;
}

function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const PlaylistCollage = ({ playlist, userId }) => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !playlist?.id) return;

    let isMounted = true;
    setLoading(true);

    fetchTracksFromPlaylist(userId, playlist.id)
      .then((t) => {
        if (isMounted) {
          setTracks(t || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch tracks for collage", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, playlist?.id, playlist?.updatedAt]); // Re-fetch if playlist updates

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        <span style={{ opacity: 0.5 }}>🎵</span>
      </div>
    );
  }

  // 0 Tracks -> Default Icon
  if (tracks.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        🎵
      </div>
    );
  }

  // 1-3 Tracks -> First track's cover
  if (tracks.length < 4) {
    const imgUrl = tracks[0]?.image ? getProxiedImage(tracks[0].image) : null;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Playlist cover"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <span style={{ fontSize: 28 }}>🎵</span>
        )}
      </div>
    );
  }

  // 4+ Tracks -> 2x2 Collage, shuffling every 5 hours predictably
  // 5 hours = 5 * 60 * 60 * 1000 ms
  const seedCycle = Math.floor(Date.now() / (5 * 60 * 60 * 1000));
  
  // Clone tracks and shuffle deterministically
  const shuffledTracks = [...tracks].sort((a, b) => {
    // We use track ids and seed loop to create a float
    const hashA = a.id.charCodeAt(0) + seedCycle;
    const hashB = b.id.charCodeAt(0) + seedCycle;
    return seededRandom(hashA) - seededRandom(hashB);
  });

  const top4 = shuffledTracks.slice(0, 4);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 10,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        background: "#16213e", // Fallback color
      }}
    >
      {top4.map((t, idx) => {
        const imgUrl = t?.image ? getProxiedImage(t.image) : null;
        return (
          <div
            key={t.id || idx}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            ) : (
              <span style={{ fontSize: 16 }}>🎵</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PlaylistCollage;
