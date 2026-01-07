export default function Overlays({
  currentUser,
  hasInteracted,
  selectedAlbum,

  playNextQueue,
  playNext, // queue controller object
  clearQueue,
  player,
  isPlaying,

  setShowQueuePanel,
  showQueuePanel,
}) {
  return (
    <>
      {/* Floating Queue Button (desktop) */}
      <button
        className="hidden md:flex fixed bottom-4 right-4 bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-full shadow-lg z-50"
        onClick={() => setShowQueuePanel(true)}
      >
        Queue ({playNextQueue.length})
      </button>

      {/* Mobile Mini Player */}
      {currentUser && hasInteracted && selectedAlbum && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur z-40 px-3 py-2 flex items-center gap-3">
          <img
            src={selectedAlbum.image}
            alt={selectedAlbum.title}
            className="w-10 h-10 rounded object-cover"
          />

          <div className="flex-1 overflow-hidden">
            <p className="text-xs truncate">{selectedAlbum.title}</p>
            <p className="text-[10px] text-white/60 truncate">
              {selectedAlbum.artist}
            </p>
          </div>

          <button
            onClick={player.playPause}
            className="px-2 py-1 text-sm bg-purple-700 rounded"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          {/* ✅ FIXED */}
          <button
            onClick={playNext}
            className="px-2 py-1 text-sm bg-purple-700 rounded"
          >
            Next
          </button>

          <button
            className="ml-2 text-xs underline"
            onClick={() => setShowQueuePanel(true)}
          >
            Queue ({playNextQueue.length})
          </button>
        </div>
      )}

      {/* Queue Panel */}
      {showQueuePanel && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center">
          <div className="bg-zinc-900 w-full md:w-[480px] max-h-[90vh] rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-lg font-semibold">Play Next Queue</h3>
              <button
                onClick={() => setShowQueuePanel(false)}
                className="text-sm"
              >
                ✖
              </button>
            </div>

            {playNextQueue.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                Queue is empty
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
                {playNextQueue.map((item, idx) => (
                  <li
                    key={item.id}
                    className="px-4 py-3 flex items-center gap-2"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-10 h-10 rounded object-cover"
                    />

                    <div className="flex-1">
                      <p className="text-sm truncate">{item.title}</p>
                      <p className="text-xs text-white/60 truncate">
                        {item.artist}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => playNext.move(idx, -1)}
                        className="px-2 py-1 text-xs bg-zinc-700 rounded disabled:opacity-30"
                      >
                        ↑
                      </button>

                      <button
                        disabled={idx === playNextQueue.length - 1}
                        onClick={() => playNext.move(idx, 1)}
                        className="px-2 py-1 text-xs bg-zinc-700 rounded disabled:opacity-30"
                      >
                        ↓
                      </button>

                      <button
                        onClick={() => playNext.remove(item.id)}
                        className="px-2 py-1 text-xs bg-red-700 rounded"
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {playNextQueue.length > 0 && (
              <div className="p-3 border-t border-white/10 flex justify-between">
                <button
                  className="text-sm underline"
                  onClick={() => setShowQueuePanel(false)}
                >
                  Close
                </button>
                <button
                  className="bg-red-700 px-3 py-1 rounded text-sm"
                  onClick={clearQueue}
                >
                  Clear Queue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
