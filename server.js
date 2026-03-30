// server.js
// Full backend with song detection, lyrics, proxy, and AI integration (Melo Flask server)
const recommendationsRoute = require("./server/routes/recommendations");

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const multer = require("multer");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

// ✅ CORRECT PATH BASED ON YOUR STRUCTURE
const flowcastRoutes = require("./server/routes/flowcast");

const admin = require("./server/firebaseAdmin");
const db = admin.firestore();
/* ===========================================================
 END Firebase Admin
=========================================================== */

const app = express();
const PORT = process.env.PORT || 4000;
const upload = multer({ dest: "uploads/" });
const MELO_API_URL =
  process.env.MELO_API_URL || "http://localhost:5001"; // Flask AI service URL

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://melopra.vercel.app"
  ],
  credentials: true,
}));
// ✅ Body parser next
app.use(express.json());

// ✅ Routes AFTER middleware
app.use("/api", recommendationsRoute);


// ✅ FIX: REGISTER FLOWCAST BEFORE THE SECURITY MIDDLEWARE
app.use("/api/flowcast", flowcastRoutes);

/* -----------------------------------------------------------
 🌐 Root route — production health check
----------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("Melopra backend running 🚀");
});

/* -----------------------------------------------------------
 🧠 DEBUG: Basic server health check
----------------------------------------------------------- */
app.get("/ping", (req, res) => {
  console.log("PING received from", req.ip);
  res.json({
    ok: true,
    name: "server",
    env_acoustid: !!process.env.ACOUSTID_KEY,
    env_genius: !!process.env.GENIUS_TOKEN,
    connected_to_melo: !!MELO_API_URL,
  });
});

/* -----------------------------------------------------------
 🧠 NEW: ML USER EVENT LOGGING (RECOMMENDER SYSTEM)
----------------------------------------------------------- */
app.post("/api/log_event", async (req, res) => {
  try {
    const {
      userId,
      songId,
      event, // play | complete | skip | repeat
      playDuration = 0,
      songDuration = 0,
    } = req.body || {};

    if (!userId || !songId || !event) {
      return res.status(400).json({
        error: "Missing required fields (userId, songId, event)",
      });
    }

    await db.collection("user_events").add({
      userId,
      songId,
      event,
      playDuration,
      songDuration,
      timestamp: Date.now(),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ log_event error:", err);
    return res.status(500).json({ error: "Failed to log event" });
  }
});

/* -----------------------------------------------------------
 🔐 FIXED: SECURITY MIDDLEWARE NOW AFTER /api/flowcast
----------------------------------------------------------- */

/* -----------------------------------------------------------
 🔊 Helper: ffmpeg + fpcalc for acoustic ID
----------------------------------------------------------- */
function toWav(inputPath, outPath) {
  const res = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-ar", "44100", "-ac", "2", outPath],
    { encoding: "utf8" }
  );
  if (res.status !== 0) throw new Error("ffmpeg failed: " + res.stderr);
  return outPath;
}

function fpcalc(filePath) {
  const res = spawnSync("fpcalc", ["-json", filePath], {
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error("fpcalc failed: " + res.stderr);
  try {
    return JSON.parse(res.stdout);
  } catch (e) {
    throw new Error("fpcalc parse error: " + e.message);
  }
}

/* -----------------------------------------------------------
 🎵 Endpoint: Song detection (AcoustID)
----------------------------------------------------------- */
app.post("/api/detect", upload.single("demo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing file" });
  const tmpPath = req.file.path;
  const wavPath = tmpPath + ".wav";
  try {
    toWav(tmpPath, wavPath);
    const info = fpcalc(wavPath);
    const ACOUSTID_KEY = process.env.ACOUSTID_KEY || "";
    if (!ACOUSTID_KEY)
      return res.status(500).json({ error: "ACOUSTID_KEY not set" });

    const url = `https://api.acoustid.org/v2/lookup?client=${encodeURIComponent(
      ACOUSTID_KEY
    )}&fingerprint=${encodeURIComponent(
      info.fingerprint
    )}&duration=${Math.round(
      info.duration
    )}&meta=recordings+releasegroups+compress`;

    const r = await fetch(url);
    const j = await r.json();
    const matches = [];

    if (j.results && j.results.length) {
      for (const result of j.results) {
        if (result.recordings && result.recordings.length) {
          for (const rec of result.recordings) {
            matches.push({
              title: rec.title || null,
              artist: rec.artists?.map((a) => a.name).join(", ") || null,
              score: result.score || null,
              recordings: rec.id
                ? `musicbrainz:recording:${rec.id}`
                : null,
            });
          }
        }
      }
    }

    res.json({ matches });
  } catch (err) {
    console.error("detect error:", err.message || err);
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    try {
      fs.unlinkSync(tmpPath);
      fs.unlinkSync(wavPath);
    } catch {}
  }
});

/* -----------------------------------------------------------
 🎤 Endpoint: Humming search (placeholder)
----------------------------------------------------------- */
app.post("/api/humsearch", upload.single("demo"), async (req, res) => {
  return res.status(501).json({
    error: "Not implemented",
    message: "Requires CLAP/OpenL3 embeddings + FAISS search.",
  });
});

/* -----------------------------------------------------------
 🧾 Endpoint: Lyrics fetch using Genius API
----------------------------------------------------------- */
app.get("/api/lyrics", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

  const GENIUS_TOKEN = process.env.GENIUS_TOKEN || "";
  try {
    const headers = GENIUS_TOKEN
      ? { Authorization: `Bearer ${GENIUS_TOKEN}` }
      : {};
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(
      q
    )}`;
    const searchResp = await axios.get(searchUrl, { headers });

    const hits = searchResp.data?.response?.hits || [];
    if (!hits.length) return res.json({ found: false });

    const best = hits[0].result;
    const songUrl = best.url;
    const page = await axios.get(songUrl, {
      headers: { "User-Agent": "Melopra/1.0" },
    });
    const $ = cheerio.load(page.data);

    let lyrics = "";
    $(
      "div.lyrics, .lyrics, .Lyrics__Container, [data-lyrics-container='true']"
    ).each((i, el) => {
      const text = $(el).text();
      if (text?.trim().length) lyrics += text + "\n\n";
    });

    if (!lyrics)
      lyrics = $("meta[name='description']").attr("content") || "";

    res.json({
      found: true,
      title: best.title,
      artist: best.primary_artist?.name,
      lyrics,
      source: songUrl,
    });
  } catch (err) {
    console.error("lyrics error:", err.message || err);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------------------------------
 🧠 Melo AI Integration
----------------------------------------------------------- */
app.get("/api/play-song", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing ?q= parameter" });

  try {
    const r = await fetch(
      `${MELO_API_URL}/api/play-song?q=${encodeURIComponent(query)}`
    );
    const data = await r.json();
    if (r.ok) return res.json(data);
    return res.status(r.status).json(data);
  } catch (err) {
    console.error(
      "❌ Error contacting Melo AI service:",
      err.message || err
    );
    res.status(500).json({ error: "Melo AI service unavailable" });
  }
});

app.get("/api/deezer-artist", async (req, res) => {
  try {
    let { artist = "", lang = "" } = req.query;
    artist = artist.trim();

    // language seeds
    const seeds = {
      english: "eminem",
      hindi: "arijit singh",
      punjabi: "karan aujla",
      tamil: "anirudh",
      telugu: "sid sriram"
    };

    const key = (lang || "english").toLowerCase();

    // if no artist search provided
    if (!artist) {
      artist = seeds[key] || "eminem";
    }

    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`;

    const response = await axios.get(url, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    let artists = (response.data?.data || [])
      .map(a => ({
        id: a.id,
        name: a.name,
        image:
          a.picture_medium ||
          "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
      }))
      .slice(0, 12);

    // fallback if Deezer returns nothing
    if (!artists.length) {
      const fallback = seeds[key] || "eminem";

      const retry = await axios.get(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(fallback)}`,
        {
          timeout: 5000,
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );

      artists = (retry.data?.data || [])
        .map(a => ({
          id: a.id,
          name: a.name,
          image:
            a.picture_medium ||
            "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
        }))
        .slice(0, 12);
    }

    res.json({ artists });

  } catch (err) {
    console.error("Deezer artist error:", err.message);

    // safe fallback instead of 500
    res.json({
      artists: [
        {
          id: "fallback1",
          name: "Eminem",
          image: "https://e-cdns-images.dzcdn.net/images/artist/0e1d6f8c2f1e0a4d2d3b6a2e0e2a7a2/500x500-000000-80-0-0.jpg"
        },
        {
          id: "fallback2",
          name: "Arijit Singh",
          image: "https://e-cdns-images.dzcdn.net/images/artist/6a7c55e9c96c6c46c1d43c2dba4e4c0c/500x500-000000-80-0-0.jpg"
        }
      ]
    });
  }
});

/* -----------------------------------------------------------
 🎧 Proxy Route (stream passthrough)
----------------------------------------------------------- */
app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing URL parameter");

  try {
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Melopra/1.0" },
    });
    if (!response.ok)
      return res.status(response.status).send("Failed to fetch stream");
    res.setHeader(
      "Content-Type",
      response.headers.get("Content-Type") || "audio/mpeg"
    );
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy server error");
  }
});

/* -----------------------------------------------------------
 🚀 Start the server
----------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
