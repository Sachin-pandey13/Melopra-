import { useState } from "react";

import BottomNav from "./BottomNav";
import CustomAudioPlayer from "./components/CustomAudioPlayer";
import MiniPlayer from "./components/MiniPlayer";
import VoiceAssistant from "./components/VoiceAssistant";
import PlayerBackdrop from "./components/PlayerBackdrop";
import GlobalBackdrop from "./components/GlobalBackdrop";

import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import LibraryScreen from "./screens/LibraryScreen";
import QueueScreen from "./screens/QueueScreen";

import { useNowPlaying } from "./state/useNowPlaying";

export default function MobileHome({ allItems = [], actions, library }) {
  const [activeTab, setActiveTab] = useState("home");
  const { isExpanded } = useNowPlaying();

  const renderScreen = () => {
    const screenProps = { allItems, actions, library };

    switch (activeTab) {
      case "search":
        return <SearchScreen {...screenProps} />;
      case "library":
        return <LibraryScreen {...screenProps} />;
      case "queue":
        return <QueueScreen />;
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        color: "#fff",
        background: "radial-gradient(ellipse at top, #1a1a1a 0%, #000000 100%)",
      }}
    >
      {/* 🌫️ SAME BLUR + COLOR AS MINI PLAYER */}
      <GlobalBackdrop intensity={50} opacity={1} />

      {/* 🎵 STRONGER BLUR FOR EXPANDED PLAYER */}
      <PlayerBackdrop />

      {/* MAIN CONTENT */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          overflowY: "auto",
          paddingBottom: isExpanded ? 0 : 112,
        }}
      >
        {renderScreen()}
      </div>

      {/* MELO VOICE ASSISTANT */}
      {!isExpanded && <VoiceAssistant />}

      {/* AUDIO ENGINE */}
      <CustomAudioPlayer />

      {/* MINI + EXPANDED PLAYER */}
      <MiniPlayer />

      {/* BOTTOM NAV */}
      {!isExpanded && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ========== ADD TO PLAYLIST PICKER MODAL ========== */}
      {library?.showAddToPlaylist && library?.pendingAddSong && (
        <AddToPlaylistPicker
          song={library.pendingAddSong}
          playlists={library.playlists}
          onAdd={(playlistId) => {
            library.addToPlaylist(library.pendingAddSong, playlistId);
            library.closeAddToPlaylist();
          }}
          onClose={library.closeAddToPlaylist}
          onCreateNew={library.openCreatePlaylist}
        />
      )}

      {/* ========== CREATE PLAYLIST MODAL (from swipe flow) ========== */}
      {library?.showCreatePlaylistModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={library.closeCreatePlaylist}
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
            <input
              value={library.newPlaylistName}
              onChange={(e) => library.setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              autoFocus
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
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={library.closeCreatePlaylist}
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
                disabled={!library.newPlaylistName.trim()}
                onClick={async () => {
                  const newPl = await library.createNewPlaylist();
                  // If we had a pending song, add it to the new playlist
                  if (newPl && library.pendingAddSong) {
                    await library.addToPlaylist(library.pendingAddSong, newPl.id);
                    library.closeAddToPlaylist();
                  }
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: library.newPlaylistName.trim()
                    ? "linear-gradient(135deg, #1DB954, #1ed760)"
                    : "rgba(255,255,255,0.05)",
                  color: "white",
                  fontWeight: 600,
                  cursor: library.newPlaylistName.trim() ? "pointer" : "default",
                  opacity: library.newPlaylistName.trim() ? 1 : 0.4,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== ADD TO PLAYLIST PICKER ========== */
function AddToPlaylistPicker({ song, playlists, onAdd, onClose, onCreateNew }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(28,28,28,0.98)",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px",
          maxHeight: "60vh",
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Add to Playlist</h3>
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {song?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              width: 32,
              height: 32,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Create New */}
        <button
          onClick={onCreateNew}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            marginBottom: 8,
            fontSize: 14,
          }}
          className="active:scale-[0.98] transition-transform"
        >
          <span style={{ fontSize: 20 }}>+</span>
          New Playlist
        </button>

        {/* Playlist list */}
        {playlists.map((pl) => (
          <button
            key={pl.id}
            onClick={() => onAdd(pl.id)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              background: "rgba(255,255,255,0.04)",
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
            <span style={{ fontSize: 18 }}>🎵</span>
            {pl.name}
          </button>
        ))}

        {playlists.length === 0 && (
          <p style={{ textAlign: "center", opacity: 0.4, fontSize: 13, padding: 16 }}>
            No playlists yet. Create one above!
          </p>
        )}
      </div>
    </div>
  );
}
