// server/quotaManager.js
// ─────────────────────────────────────────────────────────────
// Professional API quota manager for Melopra.
// Tracks daily YouTube quota, per-IP rate limits for Shazam,
// and prevents any form of API quota spam.
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// 1. YouTube Quota Manager
//    10,000 units/day — videos.list = 1 unit, search = 100 units
// ═══════════════════════════════════════════════════════════════

const YOUTUBE_DAILY_BUDGET = 9000; // leave 10% of 10,000 as buffer

const youtubeState = {
  used: 0,
  resetAt: _nextMidnightUTC(),
};

function _nextMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return tomorrow.getTime();
}

function _checkYoutubeReset() {
  if (Date.now() >= youtubeState.resetAt) {
    console.log("[QUOTA] YouTube quota reset for new day.");
    youtubeState.used = 0;
    youtubeState.resetAt = _nextMidnightUTC();
  }
}

/**
 * Check if a YouTube API call can proceed.
 * @param {number} cost  quota units this call will consume (default 1 for videos.list)
 * @returns {{ allowed: boolean, used: number, budget: number, percentUsed: number }}
 */
function canUseYoutube(cost = 1) {
  _checkYoutubeReset();
  const allowed = youtubeState.used + cost <= YOUTUBE_DAILY_BUDGET;
  return {
    allowed,
    used: youtubeState.used,
    budget: YOUTUBE_DAILY_BUDGET,
    percentUsed: Math.round((youtubeState.used / YOUTUBE_DAILY_BUDGET) * 100),
  };
}

/**
 * Record YouTube quota consumption after a successful API call.
 * @param {number} cost
 */
function consumeYoutube(cost = 1) {
  _checkYoutubeReset();
  youtubeState.used += cost;

  const pct = Math.round((youtubeState.used / YOUTUBE_DAILY_BUDGET) * 100);
  if (pct >= 80 && pct % 10 === 0) {
    console.warn(`[QUOTA] ⚠️ YouTube quota at ${pct}% (${youtubeState.used}/${YOUTUBE_DAILY_BUDGET})`);
  }
}

/**
 * Mark YouTube quota as fully exhausted (called when API returns quotaExceeded).
 */
function markYoutubeExhausted() {
  youtubeState.used = YOUTUBE_DAILY_BUDGET;
  console.error("[QUOTA] 🚨 YouTube quota EXHAUSTED. Blocking until midnight UTC.");
}

// ═══════════════════════════════════════════════════════════════
// 2. Per-IP Token Bucket Rate Limiter (for RapidAPI/Shazam)
//    Prevents audio spam: max N requests per IP per window
// ═══════════════════════════════════════════════════════════════

class TokenBucket {
  /**
   * @param {number} capacity   max requests per window
   * @param {number} windowMs   window length in ms
   */
  constructor(capacity, windowMs) {
    this.capacity  = capacity;
    this.windowMs  = windowMs;
    this._buckets  = new Map(); // ip -> { count, windowStart }

    // Auto-clean stale buckets every minute
    setInterval(() => this._clean(), 60 * 1000);
  }

  /**
   * Attempt to consume one token for the given key.
   * @param {string} key  typically the client IP
   * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
   */
  consume(key) {
    const now = Date.now();
    let bucket = this._buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      // New window
      bucket = { count: 0, windowStart: now };
      this._buckets.set(key, bucket);
    }

    const remaining = this.capacity - bucket.count - 1;
    if (bucket.count >= this.capacity) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: this.windowMs - (now - bucket.windowStart),
      };
    }

    bucket.count++;
    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      resetInMs: this.windowMs - (now - bucket.windowStart),
    };
  }

  _clean() {
    const now = Date.now();
    for (const [key, bucket] of this._buckets) {
      if (now - bucket.windowStart >= this.windowMs * 2) {
        this._buckets.delete(key);
      }
    }
  }
}

// Rate limiters per endpoint
const rateLimiters = {
  // Shazam/detect: 5 requests per IP per 60 seconds
  detect: new TokenBucket(5, 60 * 1000),

  // Lyrics: 20 requests per IP per 60 seconds (generous but protected)
  lyrics: new TokenBucket(20, 60 * 1000),

  // Deezer: 30 requests per IP per 60 seconds
  deezer: new TokenBucket(30, 60 * 1000),

  // Recommendations: 10 per IP per 60 seconds
  recommendations: new TokenBucket(10, 60 * 1000),
};

/**
 * Express middleware factory — returns a rate-limit middleware for a named endpoint.
 * @param {"detect"|"lyrics"|"deezer"|"recommendations"} endpoint
 * @returns {function} express middleware
 */
function rateLimitMiddleware(endpoint) {
  const limiter = rateLimiters[endpoint];
  if (!limiter) throw new Error(`No rate limiter for endpoint: ${endpoint}`);

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const result = limiter.consume(ip);

    // Always set standard rate-limit headers
    res.setHeader("X-RateLimit-Limit",     limiter.capacity);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset",     Math.ceil(result.resetInMs / 1000));

    if (!result.allowed) {
      console.warn(`[RATE-LIMIT] ${ip} blocked on /${endpoint} — retry in ${Math.ceil(result.resetInMs / 1000)}s`);
      return res.status(429).json({
        error:   "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Try again in ${Math.ceil(result.resetInMs / 1000)} seconds.`,
        retryAfter: Math.ceil(result.resetInMs / 1000),
      });
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. Quota Status (for /api/debug/quota endpoint)
// ═══════════════════════════════════════════════════════════════

function getQuotaStatus() {
  _checkYoutubeReset();
  return {
    youtube: {
      used:        youtubeState.used,
      budget:      YOUTUBE_DAILY_BUDGET,
      remaining:   YOUTUBE_DAILY_BUDGET - youtubeState.used,
      percentUsed: Math.round((youtubeState.used / YOUTUBE_DAILY_BUDGET) * 100),
      resetsAt:    new Date(youtubeState.resetAt).toISOString(),
    },
  };
}

module.exports = {
  // YouTube
  canUseYoutube,
  consumeYoutube,
  markYoutubeExhausted,

  // Rate limiting
  rateLimitMiddleware,

  // Debug
  getQuotaStatus,
};
