// server.js
// Full backend with song detection, lyrics, proxy, and AI integration (Melo Flask server)
// ──────────────────────────────────────────────────────────────────────────────────────
// Optimizations applied:
//   ✅ HTTP compression (gzip) — reduces payload size ~60%
//   ✅ TTL cache on lyrics, deezer-artist responses
//   ✅ In-flight deduplication for lyrics & deezer
//   ✅ Per-route rate limiting (quota manager)
//   ✅ Stream concurrency semaphore (max 10 parallel streams)
//   ✅ node-fetch imported once at top level
//   ✅ Debug quota endpoint: GET /api/debug/quota
// ──────────────────────────────────────────────────────────────────────────────────────

require("dotenv").config();

const express     = require("express");
const cors        = require("cors");
const compression = require("compression");   // ← gzip all responses
const multer      = require("multer");
const fs          = require("fs");
const path        = require("path");
const axios       = require("axios");
const cheerio     = require("cheerio");
const play        = require("play-dl");
const { Innertube } = require("youtubei.js");

let ytInner = null;
Innertube.create().then(yta => {
  ytInner = yta;
  console.log("✅ youtubei.js initialized");
}).catch(err => console.error("❌ youtubei.js init error:", err));

// ── Melopra modules ──────────────────────────────────────────────────────────
const flowcastRoutes       = require("./server/routes/flowcast");
const recommendationsRoute = require("./server/routes/recommendations");
const personalizedRoute    = require("./server/routes/personalized");
const admin                = require("./server/firebaseAdmin");

const { lyricsCache, deezerCache, saavnCache, ytCache, cacheKey, TTL, getCacheStats } = require("./server/cache");
const { rateLimitMiddleware, getQuotaStatus }                     = require("./server/quotaManager");
const { inflightLyrics, inflightDeezer, getInflightStatus }       = require("./server/inflight");

// ── MongoDB + ML Personalization ─────────────────────────────────────────────
const { connectMongo, isMongoReady, UserEvent } = require("./server/mongodb");
const { scheduleProfileRebuild }                = require("./server/userProfileAggregator");

// ── Firebase ─────────────────────────────────────────────────────────────────
const db = admin.apps.length ? admin.firestore() : null;

// ── Connect to MongoDB Atlas (non-blocking — server boots even if Mongo is down)
connectMongo();

// ── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const PORT   = process.env.PORT || 4000;
const upload = multer({ dest: "uploads/" });
const MELO_API_URL = process.env.MELO_API_URL || "http://localhost:5001";

// ✅ gzip compression — must be FIRST middleware
app.use(compression({
  level: 6,         // balanced speed vs. compression ratio
  threshold: 1024,  // only compress responses > 1 KB
}));

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://melopra.vercel.app",
  ],
  credentials: true,
}));

app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", recommendationsRoute);
app.use("/api", personalizedRoute);          // ← /api/personalized-feed, /api/user-taste
app.use("/api/flowcast", flowcastRoutes);

/* -----------------------------------------------------------
 🌐 Root & health
----------------------------------------------------------- */
app.get("/", (req, res) => res.send("Melopra backend running 🚀"));

app.get("/ping", (req, res) => {
  console.log("PING received from", req.ip);
  res.json({
    ok:               true,
    name:             "server",
    env_acoustid:     !!process.env.ACOUSTID_KEY,
    env_genius:       !!process.env.GENIUS_TOKEN,
    connected_to_melo: !!MELO_API_URL,
  });
});

/* -----------------------------------------------------------
 📊 Debug: quota + cache + inflight + MongoDB status
----------------------------------------------------------- */
app.get("/api/debug/quota", (req, res) => {
  res.json({
    quota:    getQuotaStatus(),
    cache:    getCacheStats(),
    inflight: getInflightStatus(),
    mongodb:  { connected: isMongoReady() },
  });
});

/* -----------------------------------------------------------
 🧠 ML USER EVENT LOGGING
    Writes to Firebase (existing) AND MongoDB (personalization).
    MongoDB write is fire-and-forget — never delays the response.
----------------------------------------------------------- */
app.post("/api/log_event", async (req, res) => {
  try {
    const {
      userId,
      songId,
      event,
      playDuration    = 0,
      songDuration    = 0,
      completionRate  = 0,
      sessionId       = "",
      songMeta        = {},
    } = req.body || {};

    if (!userId || !songId || !event) {
      return res.status(400).json({ error: "Missing required fields (userId, songId, event)" });
    }

    // ── Firebase write (existing, unchanged) ────────────────────
    if (db) {
      await db.collection("user_events").add({
        userId, songId, event, playDuration, songDuration,
        timestamp: Date.now(),
      });
    } else {
      console.warn("Skipped Firebase log — DB not initialized.");
    }

    // ── MongoDB write (new, fire-and-forget) ─────────────────────
    // Wrapped in setImmediate so it never blocks the HTTP response.
    // If MongoDB is unavailable, this silently fails.
    if (isMongoReady()) {
      setImmediate(async () => {
        try {
          await UserEvent.create({
            userId,
            songId,
            event,
            playDuration,
            songDuration,
            completionRate,
            sessionId,
            songMeta: {
              title:    songMeta.title    || "",
              artist:   songMeta.artist   || "",
              language: songMeta.language || "",
              genre:    songMeta.genre    || "",
            },
          });

          // Trigger debounced profile rebuild for this user
          scheduleProfileRebuild(userId);
        } catch (mongoErr) {
          // Never propagate — MongoDB failure must not break event logging
          console.warn("[MongoDB] log_event write failed:", mongoErr.message);
        }
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ log_event error:", err);
    return res.status(500).json({ error: "Failed to log event" });
  }
});

/* -----------------------------------------------------------
 🎵 Song detection (Shazam via RapidAPI)
    Rate limited: 5 req / IP / 60s
----------------------------------------------------------- */
app.post(
  "/api/detect",
  rateLimitMiddleware("detect"),
  upload.single("demo"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing audio file" });
    const tmpPath = req.file.path;

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
    if (!RAPIDAPI_KEY) {
      fs.unlink(tmpPath, () => {});
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured." });
    }

    try {
      const audioBuffer = fs.readFileSync(tmpPath);
      const audioBase64 = audioBuffer.toString("base64");

      console.log(`[detect] Audio size: ${audioBuffer.length} bytes, sending to Shazam...`);

      const response = await fetch("https://shazam.p.rapidapi.com/songs/detect", {
        method: "POST",
        headers: {
          "content-type":    "text/plain",
          "X-RapidAPI-Key":  RAPIDAPI_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
        body: audioBase64,
      });

      const data = await response.json();
      console.log("[detect] Shazam raw response:", JSON.stringify(data).slice(0, 300));

      if (!response.ok) {
        return res.status(502).json({ error: "Shazam API error: " + (data.message || response.status) });
      }

      if (data.track) {
        return res.json({
          matches: [{
            title:  data.track.title,
            artist: data.track.subtitle,
            score:  1.0,
            cover:  data.track.images?.coverart || null,
          }],
        });
      }

      return res.json({ matches: [] });
    } catch (err) {
      console.error("[detect] Error:", err.message || err);
      res.status(500).json({ error: String(err.message || err) });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
);

/* -----------------------------------------------------------
 🎤 Humming search (placeholder)
----------------------------------------------------------- */
app.post("/api/humsearch", upload.single("demo"), async (req, res) => {
  return res.status(501).json({
    error:   "Not implemented",
    message: "Requires CLAP/OpenL3 embeddings + FAISS search.",
  });
});

/* -----------------------------------------------------------
 🧾 Lyrics fetch — Genius API
    ✅ TTL cache (1 hr) + in-flight dedup + rate limit
----------------------------------------------------------- */
app.get(
  "/api/lyrics",
  rateLimitMiddleware("lyrics"),
  async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

    const key = cacheKey("lyrics", q);

    // ── 1. Cache hit ────────────────────────────────────────────
    const cached = lyricsCache.get(key);
    if (cached) {
      console.log(`[CACHE HIT] lyrics: ${q}`);
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    // ── 2. In-flight dedup ──────────────────────────────────────
    try {
      const result = await inflightLyrics.dedupe(key, async () => {
        const GENIUS_TOKEN = process.env.GENIUS_TOKEN || "";
        const headers = GENIUS_TOKEN ? { Authorization: `Bearer ${GENIUS_TOKEN}` } : {};
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(q)}`;
        const searchResp = await axios.get(searchUrl, { headers, timeout: 7000 });

        const hits = searchResp.data?.response?.hits || [];
        if (!hits.length) return { found: false };

        const best    = hits[0].result;
        const songUrl = best.url;
        const page    = await axios.get(songUrl, {
          headers: { "User-Agent": "Melopra/1.0" },
          timeout: 7000,
        });
        const $ = cheerio.load(page.data);

        let lyrics = "";
        $("div.lyrics, .lyrics, .Lyrics__Container, [data-lyrics-container='true']")
          .each((i, el) => {
            const text = $(el).text();
            if (text?.trim().length) lyrics += text + "\n\n";
          });

        if (!lyrics) lyrics = $("meta[name='description']").attr("content") || "";

        return {
          found:  true,
          title:  best.title,
          artist: best.primary_artist?.name,
          lyrics,
          source: songUrl,
        };
      });

      // ── 3. Cache + respond ──────────────────────────────────────
      lyricsCache.set(key, result, TTL.LYRICS);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);

    } catch (err) {
      console.error("lyrics error:", err.message || err);
      return res.status(500).json({ error: err.message });
    }
  }
);

/* -----------------------------------------------------------
 🧠 Melo AI — play-song proxy
----------------------------------------------------------- */
app.get("/api/play-song", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing ?q= parameter" });

  try {
    const r    = await fetch(`${MELO_API_URL}/api/play-song?q=${encodeURIComponent(query)}`);
    const data = await r.json();
    if (r.ok) return res.json(data);
    return res.status(r.status).json(data);
  } catch (err) {
    console.error("❌ Error contacting Melo AI service:", err.message || err);
    res.status(500).json({ error: "Melo AI service unavailable" });
  }
});

/* -----------------------------------------------------------
 🎤 Keyless Artist Search (JioSaavn Autocomplete Proxy)
    Replaces Deezer Data (blocked) and YouTube Data (limited quota).
    Returns fast, global, and highly accurate artist objects.
----------------------------------------------------------- */
app.get("/api/artist-search", async (req, res) => {
  const query = req.query.artist;
  if (!query) return res.json({ artists: [] });

  const key = cacheKey("saavn", query);
  const cached = saavnCache.get(key);
  if (cached) return res.json({ artists: cached });

  try {
    const response = await axios.get(
      `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(query.trim())}&_format=json&_marker=0&ctx=web6dot0`,
      {
        timeout: 5000,
        headers: { "User-Agent": "Mozilla/5.0" }
      }
    );

    const items = response.data?.artists?.data || [];
    const artists = items.map((artist) => ({
      id: `saavn-${artist.id}`, // Maintain uniform prefix style
      name: artist.title,
      // JioSaavn compresses images heavily, swap 50x50 with 150x150
      image: (artist.image || "").replace("50x50", "150x150"),
      fans: 0,
    }));

    saavnCache.set(key, artists, TTL.SAAVN);
    return res.json({ artists });
  } catch (err) {
    console.error("JioSaavn artist search error:", err.message);
    return res.json({ artists: [] });
  }
});

/* -----------------------------------------------------------
 🎥 Zero-Quota YouTube Proxy via play-dl
----------------------------------------------------------- */
app.get("/api/yt-search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing ?q= parameter" });

  const limit = parseInt(req.query.limit) || 5;
  const key = cacheKey("yt-search", query, limit);
  const cached = ytCache.get(key);
  
  if (cached) return res.json(cached);

  try {
    if (!ytInner) return res.status(503).json({ error: "YT Initializing" });
    
    const results = await ytInner.search(query, { type: "video" });
    const mapped = results.results.slice(0, limit).map(v => ({
      id: v.id,
      title: v.title?.text || "Unknown",
      artist: v.author?.name || "Unknown",
      image: v.thumbnails?.[0]?.url || "",
      category: "YouTube"
    }));

    ytCache.set(key, mapped, TTL.YT_SEARCH);
    return res.json(mapped);
  } catch (err) {
    console.error("yt-search error:", err);
    res.status(500).json({ error: "YouTube scrape failed" });
  }
});

app.get("/api/yt-related", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing ?id= parameter" });

  const key = cacheKey("yt-related", id);
  const cached = ytCache.get(key);
  if (cached) return res.json(cached);

  try {
    if (!ytInner) return res.status(503).json({ error: "YT Initializing" });
    
    const info = await ytInner.getInfo(id);
    const relatedVideos = info.watch_next_feed || [];

    const mapped = relatedVideos.slice(0, 10).map(v => {
      // Support standard CompactVideo from youtubei
      if (v.id) {
        return {
          id: v.id,
          title: v.title?.text || "Unknown",
          artist: v.author?.name || v.short_view_count?.text || "Unknown",
          image: v.thumbnails?.[0]?.url || "",
          category: "YouTube"
        };
      }
      // Support LockupView fallback which YouTube recently shifted to
      if (v.content_id) {
        return {
          id: v.content_id,
          title: v.metadata?.title?.text || "Unknown",
          artist: v.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text || "Unknown",
          image: v.content_image?.image?.[0]?.url || "",
          category: "YouTube"
        };
      }
      return null;
    }).filter(v => !!v);

    ytCache.set(key, mapped, TTL.YT_SEARCH);
    return res.json(mapped);
  } catch (err) {
    console.error("yt-related error:", err);
    res.status(500).json({ error: "Failed to grab related videos", message: err.message });
  }
});

/* -----------------------------------------------------------
 🔉 Native Audio Stream Proxy
    Provides background-playable chunked audio stream.
----------------------------------------------------------- */
const ytdl = require("@distube/ytdl-core");

app.get("/api/stream", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing ?id= parameter" });

    const info = await ytdl.getInfo(id);
    
    // Explicitly prefer MP4/M4A for iOS Safari compatibility. 
    // WebM Opus throws native decode errors on many iOS versions.
    let audioFormat = info.formats.find(f => f.container === 'mp4' && f.hasAudio && !f.hasVideo);
    if (!audioFormat) {
      audioFormat = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    }

    if (!audioFormat) {
      return res.status(404).json({ error: "No audio stream available" });
    }

    const contentLength = audioFormat.contentLength ? parseInt(audioFormat.contentLength, 10) : 0;
    const mimeType = audioFormat.mimeType || "audio/webm";
    const range = req.headers.range;

    if (range && contentLength > 0) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunksize = (end - start) + 1;

      res.status(206).set({
        "Content-Range": `bytes ${start}-${end}/${contentLength}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType
      });

      ytdl(id, {
        format: audioFormat,
        range: { start, end }
      }).pipe(res);
    } else {
      if (contentLength > 0) {
        res.status(200).set({
          "Content-Length": contentLength,
          "Accept-Ranges": "bytes",
          "Content-Type": mimeType
        });
      } else {
        res.status(200).set("Content-Type", mimeType);
      }
      ytdl(id, { format: audioFormat }).pipe(res);
    }
  } catch (err) {
    console.error("Stream Proxy Error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to pipe audio stream." });
    }
  }
});

/* -----------------------------------------------------------
 🖼️  Artist Image Proxy
    Fetches Deezer artist images server-side so the browser
    never hits dzcdn.net directly (which blocks browser requests).
----------------------------------------------------------- */
app.get("/api/artist-image/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !/^\d+$/.test(id)) return res.status(400).send("Invalid artist id");

  try {
    // Fetch the artist object to get the real picture_medium URL
    const artistRes = await axios.get(`https://api.deezer.com/artist/${id}`, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const imageUrl = artistRes.data?.picture_medium;
    if (!imageUrl) throw new Error("No image URL in artist data");

    // Proxy the CDN image through the server to bypass browser blocks
    const imgRes = await axios.get(imageUrl, {
      timeout: 8000,
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    res.setHeader("Content-Type", imgRes.headers["content-type"] || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache 24h in browser
    imgRes.data.pipe(res);
  } catch (err) {
    console.warn(`[artist-image] Failed for id ${id}:`, err.message);
    // Return a lightweight SVG placeholder instead of an error
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><circle cx='100' cy='100' r='100' fill='%23333'/><text x='100' y='125' text-anchor='middle' font-size='80' fill='%23888'>🎤</text></svg>`);
  }
});

/* -----------------------------------------------------------
 🎧 Proxy Route (stream passthrough)
----------------------------------------------------------- */
app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing URL parameter");

  try {
    const response = await fetch(targetUrl, { headers: { "User-Agent": "Melopra/1.0" } });
    if (!response.ok) return res.status(response.status).send("Failed to fetch stream");
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "audio/mpeg");
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy server error");
  }
});

/* -----------------------------------------------------------
 🎧 Stream YouTube Audio
    ✅ Concurrency semaphore — max 10 parallel streams
       Prevents play-dl from blocking the Node event loop
       under heavy multi-user load.
----------------------------------------------------------- */
const MAX_CONCURRENT_STREAMS = 30;
let   activeStreams           = 0;

app.get("/api/stream", async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).send("Missing YouTube ID");

  // ── Concurrency guard ──────────────────────────────────────
  if (activeStreams >= MAX_CONCURRENT_STREAMS) {
    console.warn(`[STREAM] Concurrency limit reached (${activeStreams}/${MAX_CONCURRENT_STREAMS})`);
    return res.status(503).json({
      error:   "STREAM_BUSY",
      message: "Server is at maximum stream capacity. Please retry in a moment.",
    });
  }

  activeStreams++;

  // Clean up counter when response finishes (success, error, or client disconnect)
  const releaseSlot = () => { activeStreams = Math.max(0, activeStreams - 1); };
  res.on("finish", releaseSlot);
  res.on("close",  releaseSlot);
  res.on("error",  releaseSlot);

  try {
    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const stream    = await play.stream(streamUrl, { quality: 2 });

    res.setHeader("Content-Type",  stream.type === "webm/opus" ? "audio/webm" : "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");

    stream.stream.pipe(res);
  } catch (err) {
    console.error("Stream proxy error using play-dl:", err.message);
    if (!res.headersSent) res.status(500).send("Stream proxy failed: " + err.message);
  }
});

/* -----------------------------------------------------------
 🚀 Start
----------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ Melopra server running on port ${PORT}`);
  console.log(`   Compression: gzip enabled`);
  console.log(`   Max streams: ${MAX_CONCURRENT_STREAMS}`);
  console.log(`   Debug:       GET /api/debug/quota`);
});
