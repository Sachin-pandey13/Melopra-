// server/inflight.js
// ─────────────────────────────────────────────────────────────
// In-flight request deduplication for Melopra.
//
// When multiple users simultaneously request the same resource
// (e.g., lyrics for "Shape of You"), only ONE external API call
// is made. All concurrent callers share the same Promise and
// receive the result simultaneously — no quota spam.
//
// Pattern:  User A fires fetch → returns Promise
//           User B arrives    → receives SAME Promise (no new fetch)
//           Both receive result when Promise resolves
// ─────────────────────────────────────────────────────────────

class InFlightMap {
  constructor(name) {
    this.name = name;
    this._map = new Map(); // key -> Promise
  }

  /**
   * Deduplicate an async operation keyed on `key`.
   *
   * @param {string}            key      Unique cache key for this request
   * @param {function(): Promise} factory  Async function that performs the actual work
   * @returns {Promise<*>}              Result of the factory (shared across callers)
   */
  async dedupe(key, factory) {
    // If already in-flight, piggyback on existing promise
    if (this._map.has(key)) {
      console.log(`[INFLIGHT:${this.name}] Deduped request for key: ${key}`);
      return this._map.get(key);
    }

    // Create the promise and register it
    const promise = factory().finally(() => {
      // Remove from in-flight map once settled (resolved or rejected)
      this._map.delete(key);
    });

    this._map.set(key, promise);
    return promise;
  }

  /** How many requests are currently in-flight. */
  get size() {
    return this._map.size;
  }

  /** Active in-flight keys (for debug). */
  keys() {
    return [...this._map.keys()];
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton in-flight maps per endpoint
// ─────────────────────────────────────────────────────────────
const inflightLyrics         = new InFlightMap("lyrics");
const inflightDeezer         = new InFlightMap("deezer");
const inflightFlowcast       = new InFlightMap("flowcast");
const inflightRecommendations = new InFlightMap("recommendations");

/**
 * Return all in-flight request counts (for /api/debug/quota).
 */
function getInflightStatus() {
  return {
    lyrics:          inflightLyrics.size,
    deezer:          inflightDeezer.size,
    flowcast:        inflightFlowcast.size,
    recommendations: inflightRecommendations.size,
  };
}

module.exports = {
  inflightLyrics,
  inflightDeezer,
  inflightFlowcast,
  inflightRecommendations,
  getInflightStatus,
};
