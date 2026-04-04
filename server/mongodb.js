// server/mongodb.js
// ─────────────────────────────────────────────────────────────
// MongoDB Atlas connection singleton for Melopra.
// Production-safe: server still starts if MongoDB is unavailable.
// All collections and indexes are created automatically on first use.
// ─────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

// ── Connection state ──────────────────────────────────────────
let _isConnected = false;

/**
 * Connect to MongoDB Atlas.
 * Silently fails — caller must never await this in a critical path.
 */
async function connectMongo() {
  if (_isConnected) return;
  if (!MONGODB_URI) {
    console.warn("[MongoDB] ⚠️  MONGODB_URI not set — personalization disabled.");
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,   // fail fast if Atlas unreachable
      socketTimeoutMS:          30000,
      maxPoolSize:              10,      // connection pool for concurrent users
    });

    _isConnected = true;
    console.log("✅ [MongoDB] Connected to Atlas — melopra database");
  } catch (err) {
    console.error("[MongoDB] ❌ Connection failed:", err.message);
    // Non-fatal — existing Firebase logic continues normally
  }
}

mongoose.connection.on("disconnected", () => {
  _isConnected = false;
  console.warn("[MongoDB] Disconnected. Will reconnect on next request.");
});

mongoose.connection.on("reconnected", () => {
  _isConnected = true;
  console.log("[MongoDB] Reconnected.");
});

/** Returns true if MongoDB is ready to use. */
function isMongoReady() {
  return _isConnected && mongoose.connection.readyState === 1;
}

// ── Schemas & Models ──────────────────────────────────────────

// user_events — raw behavioral events from every user interaction
const userEventSchema = new mongoose.Schema(
  {
    userId:         { type: String, required: true, index: true },
    songId:         { type: String, required: true },
    event:          { type: String, enum: ["play", "complete", "skip", "repeat", "like"], required: true },
    playDuration:   { type: Number, default: 0 },
    songDuration:   { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },   // 0.0 – 1.0
    sessionId:      { type: String, default: "" },
    songMeta: {
      title:    { type: String, default: "" },
      artist:   { type: String, default: "" },
      language: { type: String, default: "" },
      genre:    { type: String, default: "" },
    },
  },
  {
    timestamps: true,   // adds createdAt and updatedAt automatically
    collection: "user_events",
  }
);

// Compound index for fast user-specific lookups
userEventSchema.index({ userId: 1, createdAt: -1 });
userEventSchema.index({ userId: 1, songId: 1 });

// user_profiles — aggregated taste profile rebuilt after every batch of events
const userProfileSchema = new mongoose.Schema(
  {
    userId:         { type: String, required: true, unique: true, index: true },
    artistWeights:  { type: Map, of: Number, default: {} },  // { "Arijit Singh": 4.2 }
    genreWeights:   { type: Map, of: Number, default: {} },
    langWeights:    { type: Map, of: Number, default: {} },
    topSongIds:     [{ type: String }],                       // top 50 songs by score
    avgEmbedding:   [{ type: Number }],                       // 384-dim taste vector
    totalEvents:    { type: Number, default: 0 },
    lastUpdated:    { type: Date,   default: Date.now },
  },
  {
    collection: "user_profiles",
  }
);

// Use existing model if already registered (hot-reload safety)
const UserEvent   = mongoose.models.UserEvent   || mongoose.model("UserEvent",   userEventSchema);
const UserProfile = mongoose.models.UserProfile || mongoose.model("UserProfile", userProfileSchema);

module.exports = { connectMongo, isMongoReady, UserEvent, UserProfile };
