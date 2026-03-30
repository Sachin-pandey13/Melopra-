import { useState, useEffect, useMemo } from "react";
import MobileTopBar from "../components/MobileTopBar";
import { useAuth } from "../../contexts/AuthContext";
import useLibraryController from "../../hooks/useLibraryController";
import { playItem } from "../state/useNowPlaying";
import { createPlaylist } from "../../utils/FirestorePlaylists";
import ArtistSearchPage from "./ArtistSearchPage";
import PlaylistCollage from "../components/PlaylistCollage";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

/**
 * Helper to proxy Deezer images if needed
 */
function getProxiedImage(url) {
  if (!url) return "";
  // images.weserv.nl is great for proxying and resizing CDN images
  if (url.includes("wsrv.nl") || !url.includes("dzcdn.net")) {
    return url;
  }
  // Strip https:// if present for weserv
  const cleanUrl = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${cleanUrl}&w=200&h=200&fit=cover&mask=circle`;
}

/* ---------- Album fetcher (YT search by artist) ---------- */
async function fetchAlbumsByArtist(artistName, maxResults = 6) {
  if (!YOUTUBE_API_KEY || !artistName) return [];
  try {
    const q = encodeURIComponent(`${artistName} official album full`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );
    const data = await res.json();
    if (!data.items) return [];
    return data.items.map((item) => ({
      id: `yt-${item.id.videoId}`,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      category: "YouTube",
    }));
  } catch {
    return [];
  }
}

/* ========== Reusable horizontal scroll wrapper ========== */
function HScrollRow({ title, children, emptyText, rightAction }) {
  const hasChildren =
    Array.isArray(children)
      ? children.filter(Boolean).length > 0
      : !!children;

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px" }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            opacity: 0.95,
            flex: 1,
          }}
        >
          {title}
        </h3>
        {rightAction}
      </div>

      {hasChildren ? (
        <div
          className="hide-scrollbar"
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            padding: "0 16px 4px",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `.hide-scrollbar::-webkit-scrollbar{display:none}`,
            }}
          />
          {children}
        </div>
      ) : (
        <p
          style={{
            padding: "0 16px",
            fontSize: 13,
            opacity: 0.5,
          }}
        >
          {emptyText || "Nothing here yet"}
        </p>
      )}
    </div>
  );
}

/* ========== LIBRARY SCREEN ========== */
export default function LibraryScreen({ actions, library: externalLibrary, onLoginRequest }) {
  const { currentUser } = useAuth();
  // Use the external library if provided, otherwise create our own
  const internalLibrary = useLibraryController({ currentUser });
  const library = externalLibrary || internalLibrary;

  const [albumResults, setAlbumResults] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlName, setNewPlName] = useState("");
  const [showArtistSearch, setShowArtistSearch] = useState(false);
  const [creating, setCreating] = useState(false);

  /* ---- Fetch albums based on followed artists (60-40 random split) ---- */
  useEffect(() => {
    if (!library.followedArtists || library.followedArtists.length === 0) {
      setAlbumResults([]);
      return;
    }

    let cancelled = false;
    setAlbumsLoading(true);

    (async () => {
      const artists = [...library.followedArtists];
      artists.sort(() => Math.random() - 0.5);

      const total = 12;
      const allAlbums = [];

      for (let i = 0; i < artists.length && allAlbums.length < total; i++) {
        const count = i === 0
          ? Math.ceil(total * 0.6)
          : Math.ceil((total * 0.4) / Math.max(artists.length - 1, 1));
        const results = await fetchAlbumsByArtist(artists[i].name, count);
        allAlbums.push(...results);
      }

      if (!cancelled) {
        allAlbums.sort(() => Math.random() - 0.5);
        setAlbumResults(allAlbums.slice(0, total));
        setAlbumsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [library.followedArtists]);

  /* ---- Create playlist handler ---- */
  const handleCreatePlaylist = async () => {
    if (!currentUser) { console.warn("Not logged in"); return; }
    if (!newPlName.trim() || creating) return;
    setCreating(true);
    try {
      // ✅ FIX: call Firestore directly with the local value — avoids async state race
      const newId = await createPlaylist(currentUser.uid, newPlName.trim());
      const newPl = { id: newId, name: newPlName.trim(), createdAt: new Date() };
      // Optimistically update the list
      library.setPlaylists?.((prev) => [...(prev || []), newPl]);
      setShowCreateModal(false);
      setNewPlName("");
    } catch (err) {
      console.error("Create playlist failed:", err);
      alert("Failed to create playlist. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const play = actions?.play || ((item) => playItem(item));

  /* ---- Artist Search open ---- */
  if (showArtistSearch) {
    return (
      <ArtistSearchPage
        onFollow={(artist) => library.toggleFollowArtist(artist)}
        isFollowing={(id) => library.isFollowing(id)}
        onClose={() => setShowArtistSearch(false)}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <MobileTopBar title="Your Library" />

      {/* ========== LIKED SONGS ========== */}
      <HScrollRow title="❤️ Liked Songs" emptyText="Like songs to see them here">
        {library.favorites.map((song) => (
          <SongCard key={song.id} item={song} onPlay={play} />
        ))}
      </HScrollRow>

      {/* ========== PLAYLISTS ========== */}
      <HScrollRow title="🎵 Playlists" emptyText="Create a playlist to get started">
        {/* Create Playlist Card */}
        <div
          onClick={() => currentUser ? setShowCreateModal(true) : null}
          style={{
            width: 120,
            flexShrink: 0,
            scrollSnapAlign: "start",
            cursor: currentUser ? "pointer" : "default",
            opacity: currentUser ? 1 : 0.6,
          }}
          className="active:scale-95 transition-transform"
        >
          <div
            style={{
              width: "100%",
              height: 120,
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px dashed rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            +
          </div>
          <p style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
            New Playlist
          </p>
        </div>

        {library.playlists.map((pl) => (
          <PlaylistCard
            key={pl.id}
            playlist={pl}
            currentUser={currentUser}
            onClick={() => library.openPlaylist(pl)}
          />
        ))}
      </HScrollRow>

      {/* ========== FOLLOWED ARTISTS ========== */}
      <HScrollRow
        title="🎤 Artists"
        emptyText="Follow artists to see them here"
        rightAction={
          <button
            onClick={() => setShowArtistSearch(true)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            className="active:scale-95 transition-transform"
          >
            🔍 Search
          </button>
        }
      >
        {library.followedArtists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            isFollowing={true}
            onToggleFollow={() => library.toggleFollowArtist(artist)}
          />
        ))}
      </HScrollRow>

      {/* ========== ALBUMS (from followed artists) ========== */}
      <HScrollRow
        title="💿 Albums"
        emptyText="Follow artists to discover their albums"
      >
        {albumsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.05)",
                  flexShrink: 0,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))
          : albumResults.map((album) => (
              <SongCard key={album.id} item={album} onPlay={play} />
            ))}
      </HScrollRow>

      {/* ========== ACTIVE PLAYLIST VIEW ========== */}
      {library.activePlaylist && (
        <PlaylistDetailOverlay
          playlist={library.activePlaylist}
          tracks={library.playlistTracks}
          allPlaylists={library.playlists}
          onClose={library.closePlaylist}
          onPlay={play}
          onRemove={(songId) =>
            library.removeFromPlaylist(songId, library.activePlaylist.id)
          }
          onMoveTo={async (songId, song, targetPlaylistId) => {
            // Add to new playlist, remove from current
            await library.addToPlaylist(song, targetPlaylistId);
            await library.removeFromPlaylist(songId, library.activePlaylist.id);
          }}
          onDelete={() => {
            library.removePlaylist(library.activePlaylist.id);
          }}
        />
      )}

      {/* ========== CREATE PLAYLIST MODAL ========== */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,30,30,0.95)",
              borderRadius: 16,
              padding: 24,
              width: "80%",
              maxWidth: 320,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Create Playlist</h3>
            {!currentUser && (
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>
                ⚠️ You must be logged in to create playlists.
              </p>
            )}
            <input
              value={newPlName}
              onChange={(e) => setNewPlName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              placeholder="Playlist name..."
              autoFocus
              disabled={!currentUser}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                outline: "none",
                fontSize: 14,
                marginBottom: 16,
                opacity: currentUser ? 1 : 0.5,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={!newPlName.trim() || creating || !currentUser}
                onClick={handleCreatePlaylist}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    newPlName.trim() && currentUser
                      ? "linear-gradient(135deg, #1DB954, #1ed760)"
                      : "rgba(255,255,255,0.05)",
                  color: "white",
                  fontWeight: 600,
                  cursor: newPlName.trim() && currentUser ? "pointer" : "default",
                  opacity: newPlName.trim() && currentUser ? 1 : 0.4,
                  minWidth: 70,
                }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.15}}`,
        }}
      />
    </div>
  );
}

/* ========== SONG CARD ========== */
function SongCard({ item, onPlay }) {
  return (
    <div
      onClick={() => onPlay(item)}
      style={{
        width: 130,
        flexShrink: 0,
        scrollSnapAlign: "start",
        cursor: "pointer",
      }}
      className="active:scale-95 transition-transform"
    >
      <div
        style={{
          width: "100%",
          height: 130,
          borderRadius: 8,
          backgroundImage: `url(${item.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        }}
      />
      <p
        style={{
          fontSize: 13,
          marginTop: 8,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.title}
      </p>
      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.artist || "Unknown"}
      </p>
    </div>
  );
}

/* ========== PLAYLIST CARD ========== */
function PlaylistCard({ playlist, currentUser, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 120,
        flexShrink: 0,
        scrollSnapAlign: "start",
        cursor: "pointer",
      }}
      className="active:scale-95 transition-transform"
    >
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 10,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          overflow: "hidden", // Important for the grid corners
        }}
      >
        <PlaylistCollage playlist={playlist} userId={currentUser?.uid} />
      </div>
      <p
        style={{
          fontSize: 13,
          marginTop: 6,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {playlist.name}
      </p>
    </div>
  );
}

/* ========== ARTIST CARD ========== */
function ArtistCard({ artist, onToggleFollow }) {
  return (
    <div
      style={{
        width: 100,
        flexShrink: 0,
        scrollSnapAlign: "start",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          margin: "0 auto",
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "2px solid rgba(255,255,255,0.15)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {artist.image ? (
          <img
            src={getProxiedImage(artist.image)}
            alt={artist.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <span style={{ fontSize: 28 }}>🎤</span>
        )}
      </div>
      <p
        style={{
          fontSize: 12,
          marginTop: 6,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {artist.name}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFollow();
        }}
        style={{
          marginTop: 4,
          fontSize: 10,
          padding: "3px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          cursor: "pointer",
        }}
        className="active:scale-90 transition-transform"
      >
        Following
      </button>
    </div>
  );
}

/* ========== PLAYLIST DETAIL OVERLAY (with Move-to feature) ========== */
function PlaylistDetailOverlay({ playlist, tracks, allPlaylists, onClose, onPlay, onRemove, onMoveTo, onDelete }) {
  const [moveTrack, setMoveTrack] = useState(null); // { id, ...song } being moved

  const otherPlaylists = allPlaylists.filter((p) => p.id !== playlist.id);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(14px)",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          zIndex: 10,
        }}
      >
        <button
          onClick={onClose}
          style={{
            fontSize: 18,
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>{playlist.name}</h2>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {tracks.length} song{tracks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tracks */}
      <div style={{ padding: "8px 0" }}>
        {tracks.length === 0 ? (
          <p style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>
            This playlist is empty. Long-press any song to add it.
          </p>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
              }}
            >
              <img
                src={track.image}
                alt=""
                onClick={() => onPlay(track)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  objectFit: "cover",
                  cursor: "pointer",
                }}
              />
              <div
                style={{ flex: 1, overflow: "hidden", cursor: "pointer" }}
                onClick={() => onPlay(track)}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.title}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.artist}
                </p>
              </div>

              {/* Move button */}
              {otherPlaylists.length > 0 && (
                <button
                  onClick={() => setMoveTrack(track)}
                  title="Move to another playlist"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  ↔
                </button>
              )}

              {/* Remove button */}
              <button
                onClick={() => onRemove(track.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete Playlist Button */}
      <div style={{ padding: "16px", marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => {
            if (window.confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
              onDelete();
            }
          }}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
          className="active:scale-95 transition-transform hover:bg-red-500/20"
        >
          🗑️ Delete Playlist
        </button>
      </div>

      {/* ===== Move to another playlist sheet ===== */}
      {moveTrack && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          onClick={() => setMoveTrack(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(28,28,28,0.98)",
              borderRadius: "20px 20px 0 0",
              padding: "20px 16px",
              maxHeight: "50vh",
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "none",
            }}
          >
            <h4 style={{ marginBottom: 4, fontWeight: 600, fontSize: 15 }}>
              Move to Playlist
            </h4>
            <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 14 }}>
              {moveTrack.title}
            </p>

            {otherPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={async () => {
                  await onMoveTo(moveTrack.id, moveTrack, pl.id);
                  setMoveTrack(null);
                }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  marginBottom: 4,
                  fontSize: 14,
                  textAlign: "left",
                }}
                className="active:bg-white/10 transition-colors"
              >
                <span>🎵</span> {pl.name}
              </button>
            ))}

            <button
              onClick={() => setMoveTrack(null)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                marginTop: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
