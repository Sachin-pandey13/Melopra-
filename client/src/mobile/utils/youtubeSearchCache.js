const memoryCache = new Map();
const TTL = 1000 * 60 * 10; // 10 minutes

export function getCachedSearch(query) {
  const key = query.toLowerCase().trim();
  const cached = memoryCache.get(key);

  if (!cached) return null;
  if (Date.now() - cached.time > TTL) {
    memoryCache.delete(key);
    return null;
  }

  return cached.data;
}

export function setCachedSearch(query, data) {
  const key = query.toLowerCase().trim();
  memoryCache.set(key, {
    data,
    time: Date.now(),
  });
}
