import useRightClick from "../hooks/useRightClick";

export default function LeftSidebar({
  library,
  playNextQueue,
  onPlay,
  panelLeft,
  setPanelLeft,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  panelGlowColor,
}) {
  return (
    <div
      className="resizable-panel overflow-y-auto backdrop-blur-lg rounded-xl relative isolate shadow-md hide-scrollbar group transition-all flex-shrink-0"
      style={{
        width: isSidebarCollapsed ? `${panelLeft * 0.5}%` : `${panelLeft}%`,
        minWidth: isSidebarCollapsed ? "100px" : "220px",
        maxWidth: "40%",
        height: "100%",
        background: `linear-gradient(120deg, ${
          panelGlowColor || "#ffffff20"
        } 0%, #ffffff08 100%)`,
        boxShadow: `0 0 16px ${panelGlowColor || "#ffffff40"}`,
        borderRadius: "16px",
      }}
    >
      {/* Collapse button */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-50">
        <button
          onClick={() => {
            setIsSidebarCollapsed(!isSidebarCollapsed);
            if (!isSidebarCollapsed) setPanelLeft((p) => Math.max(10, p * 0.5));
            else setPanelLeft(20);
          }}
          className="text-white bg-black/40 hover:bg-black/60 rounded-full w-6 h-6 flex items-center justify-center"
        >
          {isSidebarCollapsed ? "›" : "‹"}
        </button>
      </div>

      {!isSidebarCollapsed && (
        <div className="p-4 space-y-5">
          <h2 className="text-md font-semibold">🎶 Your Library</h2>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["Recently Played", "Liked Songs", "Playlists", "Queue"].map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    library.setSelectedLibraryTab(tab);
                    library.setActivePlaylist(null);
                  }}
                  className={`px-3 py-1 rounded-full text-xs ${
                    library.selectedLibraryTab === tab
                      ? "bg-purple-700"
                      : "bg-purple-900"
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* ===== TAB CONTENT ===== */}

          {/* Recently Played */}
          {library.selectedLibraryTab === "Recently Played" && (
            <div className="space-y-2">
              {library.recentPlayed.length === 0 ? (
                <p className="text-sm text-white/50">No recent plays</p>
              ) : (
                library.recentPlayed.map((album) => (
                  <Item
                    key={album.id}
                    album={album}
                    onPlay={onPlay}
                    isFavorite={library.isFavorite}
                  />
                ))
              )}
            </div>
          )}

          {/* Liked Songs */}
          {library.selectedLibraryTab === "Liked Songs" && (
            <div className="space-y-2">
              {library.favorites.length === 0 ? (
                <p className="text-sm text-white/50">No liked songs</p>
              ) : (
                library.favorites.map((album) => (
                  <Item
                    key={album.id}
                    album={album}
                    onPlay={onPlay}
                    isFavorite={library.isFavorite}
                  />
                ))
              )}
            </div>
          )}

          {/* Playlists */}
          {library.selectedLibraryTab === "Playlists" && (
            <div className="space-y-2">
              {library.playlists.length === 0 ? (
                <p className="text-sm text-white/50">No playlists</p>
              ) : (
                library.playlists.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-2 rounded hover:bg-white/10 cursor-pointer"
                    onClick={() => library.setActivePlaylist(pl)}
                  >
                    <p className="text-sm font-medium">{pl.name}</p>
                    <p className="text-xs text-white/50">
                      {pl.songs?.length || 0} songs
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Queue */}
          {library.selectedLibraryTab === "Queue" && (
            <div className="space-y-2">
              {playNextQueue.length === 0 ? (
                <p className="text-sm text-white/50">Queue is empty</p>
              ) : (
                playNextQueue.map((album) => (
                  <Item
                    key={album.id}
                    album={album}
                    onPlay={onPlay}
                    isFavorite={library.isFavorite}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable item WITH right-click ---------- */
function Item({ album, onPlay, isFavorite }) {
  const { onContextMenu } = useRightClick({
    id: album.id,
    title: album.title,
    artist: album.artist,
    category: album.category,
    youtubeId:
      typeof album.id === "string" && album.id.startsWith("yt-")
        ? album.id.replace("yt-", "")
        : null,
    liked: isFavorite(album.id),
  });

  return (
    <div
      className="flex items-center gap-3 p-2 rounded hover:bg-white/10 cursor-pointer"
      onClick={() => onPlay(album)}
      onContextMenu={onContextMenu}
    >
      <img
        src={album.image || album.thumbnail || album.cover}
        className="w-10 h-10 rounded object-cover"
        alt={album.title}
      />
      <div className="overflow-hidden">
        <p className="text-sm truncate">{album.title}</p>
        <p className="text-xs text-white/60 truncate">{album.artist}</p>
      </div>
    </div>
  );
}
