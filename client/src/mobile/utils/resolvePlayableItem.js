export function resolvePlayableItem(item) {
  if (!item) return null;

  // ✅ YouTube items (search + home + trending)
  if (item.category === "YouTube" && item.id) {
    return {
      id: item.id, // videoId
      title: item.title || "Unknown title",
      artist: item.artist || "YouTube",
      image:
        item.image ||
        `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`, // safer than hqdefault
      category: "YouTube",

      // ⚠️ important: downstream expects a playable reference
      audio: `https://www.youtube.com/watch?v=${item.id}`,
    };
  }

  // 🚫 everything else not supported (for now)
  console.warn("Unplayable item:", item);
  return null;
}
