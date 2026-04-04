// client/src/utils/apiCache.js
// ─────────────────────────────────────────────────────────────
// Client-side TTL cache for API responses.
// Prevents redundant network calls on:
//   - Rapid song skips (lyrics fetched 5x → only 1 real request)
//   - Tab switches / re-mounts re-triggering recommendations
//   - Autoplay queue refills for the same seed song
// ─────────────────────────────────────────────────────────────

class ClientCache {
  constructor() {
    this._store = new Map();
  }

  /**
   * Get a cached value, or undefined if missing / expired.
   * @param {string} key
   * @returns {*|undefined}
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
   * @param {number} ttlMs
   */
  set(key, value, ttlMs) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** @param {string} key */
  has(key) {
    return this.get(key) !== undefined;
  }

  /** @param {string} key */
  del(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }
}

// ─────────────────────────────────────────────────────────────
// TTL constants (milliseconds)
// ─────────────────────────────────────────────────────────────
export const CLIENT_TTL = {
  RECOMMENDATIONS: 5  * 60 * 1000,   // 5 min
  LYRICS:          10 * 60 * 1000,   // 10 min
  DEEZER:          15 * 60 * 1000,   // 15 min
};

// ─────────────────────────────────────────────────────────────
// Singleton instances
// ─────────────────────────────────────────────────────────────
export const recommendationsCache = new ClientCache();
export const lyricsCache          = new ClientCache();
export const deezerCache          = new ClientCache();

// ─────────────────────────────────────────────────────────────
// In-Flight map — prevents duplicate in-progress fetches
// from the same browser tab (e.g. React double-renders)
// ─────────────────────────────────────────────────────────────
const _inflight = new Map();

/**
 * Deduplicate an async function by key.
 * If the same key is already being fetched, returns the existing Promise.
 *
 * @param {string}            key
 * @param {function():Promise} factory
 * @returns {Promise<*>}
 */
export async function dedupeRequest(key, factory) {
  if (_inflight.has(key)) return _inflight.get(key);

  const promise = factory().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}

/**
 * Build a stable, lowercase cache key from multiple parts.
 * @param {...string} parts
 * @returns {string}
 */
export function buildKey(...parts) {
  return parts.map(p => String(p || "").trim().toLowerCase()).join("|");
}
