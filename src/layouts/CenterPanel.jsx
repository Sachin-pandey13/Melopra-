import TiltCard from "../components/TiltCard";
import LiveAlbumArt from "../components/LiveAlbumArt";
import CenterSections from "../components/center/CenterSections";
import ArtistPlaylistView from "../components/center/ArtistPlaylistView";
import useRightClick from "../hooks/useRightClick";

export default function CenterPanel({
  centerPanelRef,
  panelCenter,
  panelLeft,
  isImmersiveVisible,
  isResizing,
  panelGlowColor,

  searchTerm,
  visibleAlbums,

  selectedAlbum,
  isPlaying,
  albumArtSize,

  library,
  yt,
  currentUser,
  userDoc,

  playNext, // function
  handleAlbumSelect,
  extractYouTubeId,

  audioRef,
  setIsPlaying,
}) {
  return (
    <div
      ref={centerPanelRef}
      className="resizable-panel transition-all duration-300 overflow-y-auto backdrop-blur-lg rounded-xl shadow-md hide-scrollbar"
      style={{
        width: `${isImmersiveVisible ? panelCenter : 100 - panelLeft - 2}%`,
        transition: isResizing ? "none" : "width 0.25s ease",
        background: `linear-gradient(120deg, ${
          panelGlowColor || "#ffffff20"
        } 0%, #ffffff08 100%)`,
        boxShadow: `0 0 18px ${panelGlowColor || "#ffffff40"}`,
        borderRadius: "48px",
      }}
    >
      {/* 🔍 SEARCH RESULTS */}
      {searchTerm.trim() && visibleAlbums.length > 0 ? (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() =>
                visibleAlbums.forEach((a) =>
                  handleAlbumSelect(a, true)
                )
              }
              className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-sm"
            >
              ➕ Queue all search results
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {visibleAlbums.map((album, idx) => {
              const { onContextMenu } = useRightClick({
                id: album.id,
                title: album.title,
                artist: album.artist,
                category: album.category,
                youtubeId: extractYouTubeId(album),
                liked: library.isFavorite(album.id),
              });

              return (
                <TiltCard key={album.id} index={idx}>
                  <div
                    className="flex flex-col items-center text-center relative group"
                    onContextMenu={onContextMenu}
                  >
                    {/* ❤️ Favorite */}
                    <button
                      className="absolute top-1 left-1 z-50 bg-black/60 px-2 py-[2px] rounded text-sm hover:bg-purple-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        library.toggleFavorite(album);
                      }}
                    >
                      {library.isFavorite(album.id) ? "❤️" : "🤍"}
                    </button>

                    <LiveAlbumArt
                      audioRef={audioRef}
                      isPlaying={
                        selectedAlbum?.id === album.id && isPlaying
                      }
                      setIsPlaying={setIsPlaying}
                      onPlay={() =>
                        selectedAlbum?.id === album.id
                          ? setIsPlaying((p) => !p)
                          : handleAlbumSelect(album)
                      }
                      album={album}
                      mode="select"
                      onAlbumSelect={handleAlbumSelect}
                      size={albumArtSize}
                    />

                    <p className="mt-2 text-sm font-medium">
                      {album.title}
                    </p>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        </>
      ) : (
        /* 🪄 HOME / DYNAMIC SECTIONS */
        <div>
          <CenterSections
            apiKey={import.meta.env.VITE_YOUTUBE_API_KEY}
            yt={yt}
            currentUser={currentUser}
            userDoc={userDoc}
            recentPlayed={library.recentPlayed}
            onPlay={handleAlbumSelect}
            onQueueAll={(songs) =>
              songs.forEach((s) => handleAlbumSelect(s, true))
            }
            onAddToPlaylist={library.addToPlaylist}
            onLikeSong={library.toggleFavorite}
            onOpenArtist={library.openArtist}
          />

          {library.selectedArtist && (
            <ArtistPlaylistView
              artistData={library.selectedArtist}
              onClose={library.closeArtist}
              onPlaySong={handleAlbumSelect}
              onQueueAll={(songs) =>
                songs.forEach((s) => handleAlbumSelect(s, true))
              }
              onAddToPlaylist={library.addToPlaylist}
              onLike={library.toggleFavorite}
            />
          )}
        </div>
      )}
    </div>
  );
}
