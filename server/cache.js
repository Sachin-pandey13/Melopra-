// server/cache.js
// ─────────────────────────────────────────────────────────────
// Lightweight TTL-based in-memory cache for all external API calls.
// Eliminates redundant round-trips to YouTube, Genius, Deezer, etc.
// ─────────────────────────────────────────────────────────────

class TTLCache {
  constructor() {
    this._store = new Map();
    // Run cleanup every 5 minutes to prevent memory leaks
    setInterval(() => this._evict(), 5 * 60 * 1000);
  }

  /**
   * Get a cached value.
   * @param {string} key
   * @returns {*} cached value or undefined if expired/missing
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs  time-to-live in milliseconds
   */
  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Check if a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Manually delete a key.
   * @param {string} key
   */
  del(key) {
    this._store.delete(key);
  }

  /** Remove all expired entries. Called automatically every 5 min. */
  _evict() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }

  /** Return current cache size (for debug/monitoring). */
  get size() {
    return this._store.size;
  }

  /** Return all active (non-expired) keys (for debug). */
  keys() {
    const now = Date.now();
    return [...this._store.entries()]
      .filter(([, e]) => now <= e.expiresAt)
      .map(([k]) => k);
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton cache instances with named TTLs per data type
// ─────────────────────────────────────────────────────────────

const TTL = {
  LYRICS:          60 * 60 * 1000,      // 1 hour  — lyrics don't change
  DEEZER_ARTIST:   30 * 60 * 1000,      // 30 min
  FLOWCAST:        15 * 60 * 1000,      // 15 min  — YouTube channels
  RECOMMENDATIONS: 10 * 60 * 1000,      // 10 min  — ML results
  DETECT:          20 * 60 * 1000,      // 20 min  — Shazam detections
};

const lyricsCache        = new TTLCache();
const deezerCache        = new TTLCache();
const flowcastCache      = new TTLCache();
const recommendCache     = new TTLCache();
const detectCache        = new TTLCache();

// ─────────────────────────────────────────────────────────────
// Helper: build a stable cache key (lowercased + normalized)
// ─────────────────────────────────────────────────────────────
function cacheKey(...parts) {
  return parts
    .map((p) => String(p || "").trim().toLowerCase())
    .join("|");
}

// ─────────────────────────────────────────────────────────────
// Debug endpoint data
// ─────────────────────────────────────────────────────────────
function getCacheStats() {
  return {
    lyrics:        lyricsCache.size,
    deezer:        deezerCache.size,
    flowcast:      flowcastCache.size,
    recommendations: recommendCache.size,
    detect:        detectCache.size,
  };
}

module.exports = {
  TTL,
  lyricsCache,
  deezerCache,
  flowcastCache,
  recommendCache,
  detectCache,
  cacheKey,
  getCacheStats,
};
