export function buildInterestFeed({ allItems }) {
  const recent = JSON.parse(localStorage.getItem("melopra_recent_played")) || [];
  const counts = JSON.parse(localStorage.getItem("melopra_listen_count")) || {};
  const interests = JSON.parse(localStorage.getItem("melopra_interest")) || {};

  return allItems
    .map(item => {
      const artistKey = (item.artist || "").toLowerCase();
      const genreKey = (item.category || "").toLowerCase();

      let score = 0;
      score += (counts[artistKey] || 0) * 3;
      score += (interests[genreKey] || 0) * 2;
      score += recent.some(r => r.id === item.id) ? 2 : 0;

      return { ...item, _score: score };
    })
    .filter(i => i._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 10);
}
