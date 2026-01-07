import { useEffect, useRef } from "react";

export default function useQueueManager({
  playNextQueue,
  setPlayNextQueue,
  autoplayQueue,
  setAutoplayQueue,
  selectedAlbum,
  isPlaying,
  handleAlbumSelect,
  generateAutoplayQueue,
}) {
  const isAdvancingRef = useRef(false);

  /* ===============================
     CORE ADVANCE LOGIC
     =============================== */

  const next = async () => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    try {
      // 1️⃣ Explicit queue always wins
      if (playNextQueue.length > 0) {
        const [item, ...rest] = playNextQueue;
        setPlayNextQueue(rest);
        handleAlbumSelect(item);
        return;
      }

      // 2️⃣ Autoplay queue
      if (autoplayQueue.length > 0) {
        const [item, ...rest] = autoplayQueue;
        setAutoplayQueue(rest);
        handleAlbumSelect(item);
        return;
      }

      // 3️⃣ Generate autoplay dynamically
      if (selectedAlbum && generateAutoplayQueue) {
        const generated = await generateAutoplayQueue(selectedAlbum);
        if (generated.length > 0) {
          setAutoplayQueue(generated.slice(1));
          handleAlbumSelect(generated[0]);
        }
      }
    } finally {
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 300);
    }
  };

  /* ===============================
     QUEUE MUTATION API
     =============================== */

  const enqueue = (item) => {
    if (!item) return;
    setPlayNextQueue((prev) =>
      prev.some((p) => p.id === item.id) ? prev : [...prev, item]
    );
  };

  const enqueueMany = (items = []) => {
    if (!Array.isArray(items)) return;
    setPlayNextQueue((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const unique = items.filter((i) => i && !existing.has(i.id));
      return [...prev, ...unique];
    });
  };

  const remove = (id) => {
    setPlayNextQueue((prev) => prev.filter((i) => i.id !== id));
  };

  const move = (index, dir) => {
    setPlayNextQueue((prev) => {
      const nextQueue = [...prev];
      const target = index + dir;
      if (target < 0 || target >= nextQueue.length) return prev;
      const [item] = nextQueue.splice(index, 1);
      nextQueue.splice(target, 0, item);
      return nextQueue;
    });
  };

  const clear = () => {
    setPlayNextQueue([]);
    setAutoplayQueue([]);
  };

  /* ===============================
     AUTO-START WHEN IDLE
     =============================== */

  useEffect(() => {
    if (!isPlaying && !selectedAlbum && playNextQueue.length > 0) {
      const [item, ...rest] = playNextQueue;
      setPlayNextQueue(rest);
      handleAlbumSelect(item);
    }
  }, [playNextQueue, isPlaying, selectedAlbum]);

  /* ===============================
     PUBLIC CONTROLLER (ONE OBJECT)
     =============================== */

  return {
    playNext: next,          // advance playback
    enqueue,       // add one
    enqueueMany,   // add many
    remove,        // remove by id
    move,          // reorder
    clear,         // clear all

    // state exposure (safe + useful)
    queue: playNextQueue,
    autoplayQueue,
  };
}
