import { useEffect, useRef, useCallback } from "react";

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

  // prevent autoplay infinite loops
  const lastAdvancedIdRef = useRef(null);

  // prevents refilling autoplay too often
  const lastSeedRef = useRef(null);

  // normalize IDs (yt-xxx, firestore-xxx, raw id)
  const normalizeId = (item) => {
    if (!item) return null;

    const id = item.id || "";

    if (typeof id === "string" && id.startsWith("yt-"))
      return id.replace("yt-", "");

    if (typeof id === "string" && id.startsWith("firestore-"))
      return id.replace("firestore-", "");

    return id;
  };

  /* ===============================
     CORE ADVANCE LOGIC
     =============================== */

  const next = useCallback(async () => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    try {
      // 1️⃣ PlayNext queue always wins
      if (playNextQueue.length > 0) {
        const [item, ...rest] = playNextQueue;
        setPlayNextQueue(rest);
        await handleAlbumSelect(item);
        return;
      }

      // 2️⃣ Autoplay queue
      if (autoplayQueue.length > 0) {
        const [item, ...rest] = autoplayQueue;
        setAutoplayQueue(rest);
        await handleAlbumSelect(item);
        return;
      }

      // 3️⃣ Generate new autoplay queue (ML -> YT -> local)
      if (selectedAlbum && typeof generateAutoplayQueue === "function") {
        const seedId = normalizeId(selectedAlbum);

        console.log("🧠 Autoplay empty → generating new queue from:", seedId);

        const isOffline = !navigator.onLine;

        const generated = await generateAutoplayQueue(selectedAlbum, {
          offlineOnlyCache: true,
          allowCache: isOffline, // ✅ cache ONLY allowed when offline
        });

        if (Array.isArray(generated) && generated.length > 0) {
          const first = generated[0];
          const firstId = normalizeId(first);

          // 🚫 prevent infinite loop
          if (firstId && firstId === lastAdvancedIdRef.current) {
            console.warn("⚠️ Autoplay loop detected, skipping:", firstId);

            // drop first and retry once
            const rest = generated.slice(1);

            if (rest.length > 0) {
              const fallbackFirst = rest[0];

              lastAdvancedIdRef.current = normalizeId(fallbackFirst);

              // store rest of fallback list
              setAutoplayQueue(rest.slice(1));

              await handleAlbumSelect(fallbackFirst);
            }

            return;
          }

          lastAdvancedIdRef.current = firstId || null;

          // store rest as autoplay queue
          setAutoplayQueue(generated.slice(1));

          await handleAlbumSelect(first);
          return;
        }
      }

      console.warn("❌ No next track found (queue empty + autoplay empty)");
    } catch (err) {
      console.warn("⚠️ playNext failed:", err);
    } finally {
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 300);
    }
  }, [
    playNextQueue,
    autoplayQueue,
    selectedAlbum,
    generateAutoplayQueue,
    setPlayNextQueue,
    setAutoplayQueue,
    handleAlbumSelect,
  ]);

  /* ===============================
     QUEUE MUTATION API
     =============================== */

  const enqueue = useCallback(
    (item) => {
      if (!item?.id) return;

      setPlayNextQueue((prev) =>
        prev.some((p) => normalizeId(p) === normalizeId(item))
          ? prev
          : [...prev, item]
      );
    },
    [setPlayNextQueue]
  );

  const enqueueNext = useCallback(
    (item) => {
      if (!item?.id) return;

      setPlayNextQueue((prev) => {
        const existing = prev.filter((p) => normalizeId(p) !== normalizeId(item));
        return [item, ...existing];
      });
    },
    [setPlayNextQueue]
  );

  const enqueueMany = useCallback(
    (items = []) => {
      if (!Array.isArray(items)) return;

      setPlayNextQueue((prev) => {
        const existing = new Set(prev.map((p) => normalizeId(p)));
        const unique = items.filter(
          (i) => i?.id && !existing.has(normalizeId(i))
        );
        return [...prev, ...unique];
      });
    },
    [setPlayNextQueue]
  );

  const remove = useCallback(
    (id) => {
      if (!id) return;

      setPlayNextQueue((prev) =>
        prev.filter((i) => normalizeId(i) !== normalizeId({ id }))
      );
    },
    [setPlayNextQueue]
  );

  const move = useCallback(
    (index, dir) => {
      setPlayNextQueue((prev) => {
        const nextQueue = [...prev];
        const target = index + dir;

        if (target < 0 || target >= nextQueue.length) return prev;

        const [item] = nextQueue.splice(index, 1);
        nextQueue.splice(target, 0, item);

        return nextQueue;
      });
    },
    [setPlayNextQueue]
  );

  const clear = useCallback(() => {
    setPlayNextQueue([]);
    setAutoplayQueue([]);
    lastSeedRef.current = null;
    lastAdvancedIdRef.current = null;
  }, [setPlayNextQueue, setAutoplayQueue]);

  /* ===============================
     AUTO-FILL AUTOPLAY QUEUE (SAFE)
     =============================== */

  useEffect(() => {
    const fillAutoplay = async () => {
      if (!selectedAlbum) return;
      if (typeof generateAutoplayQueue !== "function") return;

      // already have autoplay
      if (autoplayQueue.length > 0) return;

      const seedId = normalizeId(selectedAlbum);

      // 🚫 don't regenerate autoplay for same seed repeatedly
      if (lastSeedRef.current === seedId) return;

      lastSeedRef.current = seedId;

      try {
        console.log("⚡ Filling autoplay queue for seed:", seedId);

        const isOffline = !navigator.onLine;

        const generated = await generateAutoplayQueue(selectedAlbum, {
          offlineOnlyCache: true,
          allowCache: isOffline, // ✅ cache ONLY allowed when offline
        });

        if (Array.isArray(generated) && generated.length > 0) {
          setAutoplayQueue(generated);
        }
      } catch (err) {
        console.warn("⚠️ Failed to fill autoplay queue:", err);
      }
    };

    fillAutoplay();
  }, [
    autoplayQueue.length,
    selectedAlbum,
    generateAutoplayQueue,
    setAutoplayQueue,
  ]);

  /* ===============================
     AUTO-START WHEN IDLE
     =============================== */

  useEffect(() => {
    if (!isPlaying && !selectedAlbum && playNextQueue.length > 0) {
      const [item, ...rest] = playNextQueue;
      setPlayNextQueue(rest);
      handleAlbumSelect(item);
    }
  }, [
    playNextQueue,
    isPlaying,
    selectedAlbum,
    setPlayNextQueue,
    handleAlbumSelect,
  ]);

  /* ===============================
     PUBLIC API
     =============================== */

  return {
    playNext: next,
    enqueue,
    enqueueNext,
    enqueueMany,
    remove,
    move,
    clear,

    queue: playNextQueue,
    autoplayQueue,
  };
}
