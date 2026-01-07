export function buildInterestQueries(userDoc) {
  if (!userDoc) return [];

  const {
    favoriteArtists = [],
    selectedLanguages = [],
    interestWeights = {},
  } = userDoc;

  // sort learned genres/topics based on repeats
  const weighted = Object.entries(interestWeights || {})
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);

  const queries = [
    // learned preference first
    ...weighted.slice(0, 4).map((g) => `${g} music`),

    // explicit user picks second
    ...favoriteArtists.slice(0, 3).map((a) => `${a} top songs`),

    // language fallback
    ...selectedLanguages.slice(0, 2).map((l) => `${l} best music`),
  ];

  return [...new Set(queries)].filter(Boolean);
}
