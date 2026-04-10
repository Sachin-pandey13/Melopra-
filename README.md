<div align="center">

<br/>

```
███╗   ███╗███████╗██╗      ██████╗ ██████╗ ██████╗  █████╗
████╗ ████║██╔════╝██║     ██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
██╔████╔██║█████╗  ██║     ██║   ██║██████╔╝██████╔╝███████║
██║╚██╔╝██║██╔══╝  ██║     ██║   ██║██╔═══╝ ██╔══██╗██╔══██║
██║ ╚═╝ ██║███████╗███████╗╚██████╔╝██║     ██║  ██║██║  ██║
╚═╝     ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝
```

### *Music That Thinks With You.*

<br/>

[![Live Demo](https://img.shields.io/badge/▶%20LIVE%20DEMO-melopra.vercel.app-6d28d9?style=for-the-badge&logo=vercel&logoColor=white)](https://melopra.vercel.app)
[![Backend](https://img.shields.io/badge/API-Render-00b4d8?style=for-the-badge&logo=render&logoColor=white)](#)
[![ML Worker](https://img.shields.io/badge/ML-FastAPI%20%2B%20PyTorch-EF4444?style=for-the-badge&logo=python&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](#)

<br/>

> **Melopra** is not just a music player.  
> It is a full-stack AI music intelligence platform — built from scratch — that detects what you're humming, understands your evolving taste, and streams audio natively across every device.  
> **No Spotify API. No shortcuts. Pure engineering.**

<br/>

---

</div>

## ⚡ What Makes Melopra Different

| Feature | Others | **Melopra** |
|---|---|---|
| Song Detection | Shazam app only | 🎙️ Built-in mic-based detection via RapidAPI Shazam |
| Recommendations | Static playlists | 🤖 Live ML pipeline with cosine similarity + behavioural boosts |
| Audio Streaming | Embedded iframes | 🔉 Native `<audio>` with byte-range chunked proxy |
| Background Playback | Breaks on mobile | ✅ MediaSession API with lock-screen controls |
| Personalization | Basic genre tags | 🧠 Taste centroid built from real listening vectors |
| Quota Management | Hard API limits | 🛡️ In-flight deduplication + TTL cache + concurrency semaphore |
| Platform | Web only | 📱 Responsive desktop + full-featured mobile UI |

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         CLIENT  (Vite + React 18)                     │
│                                                                       │
│   Desktop Layout (3-panel resizable)    Mobile Layout (Swipeable)     │
│   ┌─────────┬──────────────┬────────┐   ┌───────────────────────┐    │
│   │ Sidebar │ Center Panel │ Right  │   │  Home / Library /     │    │
│   │ Library │ Discover /   │Immersiv│   │  Search / Queue /     │    │
│   │   &     │ FlowCast /   │ Panel  │   │  Artist Search        │    │
│   │ Queue   │ Search       │ +Video │   └───────────────────────┘    │
│   └─────────┴──────────────┴────────┘                                │
│         Zustand State  ·  TanStack Query  ·  Framer Motion            │
└────────────────────────┬──────────────────────────────────────────────┘
                         │  HTTPS / REST
┌────────────────────────▼──────────────────────────────────────────────┐
│                    BACKEND  (Express 5 on Render)                     │
│                                                                       │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │  /api/detect │  │ /api/lyrics │  │/api/stream │  │/api/yt-*    │ │
│  │  Shazam Prxy │  │ Genius+Scrp │  │ ytdl-core  │  │ Zero-quota  │ │
│  └──────────────┘  └─────────────┘  └────────────┘  └─────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  TTL Cache  ·  In-Flight Dedup  ·  Rate Limiter  ·  Concurrency │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  Firebase Admin  ·  MongoDB Atlas (UserEvents)  ·  JioSaavn Proxy    │
└────────────────────────┬──────────────────────────────────────────────┘
                         │ HTTP (internal)
┌────────────────────────▼──────────────────────────────────────────────┐
│               ML WORKER  (FastAPI + PyTorch on Render)                │
│                                                                       │
│  SentenceTransformer (all-MiniLM-L6-v2)  ·  10K+ song embeddings     │
│  POST /recommend          — content-based cosine similarity           │
│  POST /personalized-recommend — behavioural taste-centroid vector     │
│                                                                       │
│  Personalization Boosts:                                              │
│    Preferred Artist  +0.12  ·  Language  +0.08  ·  Genre  +0.05      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Core Feature Deep-Dive

### 🤖 AI-Powered Music Recommendations
The ML Worker is a **FastAPI service running a real PyTorch/SentenceTransformer pipeline** — not a wrapper around a 3rd-party recommendation API.

- **Offline embedding generation**: 10,000+ songs are pre-encoded into 384-dimension semantic vectors using `all-MiniLM-L6-v2`
- **Content-based filtering**: Cosine similarity over title, artist, language, genre, and tags
- **Taste centroid personalization**: Averages the embedding vectors of a user's top artists to build their unique *musical center of gravity*
- **Behavioral boosts**: Events (`play`, `skip`, `replay`) are stored in MongoDB Atlas and influence real-time score adjustments
- **Artist diversity control**: Hard cap of 2–3 songs per artist to prevent echo-chamber recommendations

```python
# Taste centroid: the mathematical average of what you love
taste_vector = embeddings[preferred_artist_indices].mean(axis=0, keepdims=True)
sims = cosine_similarity(taste_vector, all_embeddings)[0]
# Then apply preference boosts...
score += 0.12  # preferred artist
score += 0.08  # preferred language
score += 0.05  # preferred genre
```

---

### 🔉 Native Audio Streaming Proxy
Forget fragile iframes. Melopra uses a custom **chunked HTTP audio proxy** powered by `@distube/ytdl-core`:

- Full **HTTP range request** support (`Content-Range`) — seekable audio on all devices
- **iOS Safari compatible**: Explicitly selects MP4/M4A format (WebM/Opus breaks iOS)
- **Concurrency semaphore**: Max 30 parallel streams, returns `503 STREAM_BUSY` gracefully beyond that
- **gzip compression** on all non-stream responses (60% payload reduction)
- **MediaSession API** integration for lock-screen controls on Android & iOS

---

### 🎙️ Real-Time Song Detection
Using the **Shazam API via RapidAPI**, users can tap a mic button and identify any song playing around them — no app switching required.

- Records audio directly from the browser microphone
- Converts to base64 and dispatches to the Shazam `/songs/detect` endpoint
- Returns title, artist, and cover art within seconds
- **Rate-limited** (5 req/IP/60s) to prevent quota exhaustion

---

### 📊 Behavioral Event Pipeline
Every interaction is silently tracked to fuel the recommendation engine:

```
User plays song → logUserEvent() → Express backend
  ├── Firebase Firestore (existing history, sync)
  └── MongoDB Atlas (new, fire-and-forget, non-blocking)
        └── scheduleProfileRebuild(userId)
              └── Rebuilds taste profile for next /personalized-feed call
```

Events tracked: `play`, `skip`, `replay` — with `playDuration`, `songDuration`, `completionRate`, and full song metadata.

---

### 🛡️ Production-Grade Backend Resilience
The backend was engineered with production workloads in mind — not a weekend project:

| Optimization | Implementation |
|---|---|
| HTTP Compression | `compression` middleware, level 6, threshold 1KB |
| TTL Caching | LRU cache for lyrics (1hr), Deezer, JioSaavn, YT results |
| In-Flight Deduplication | Prevents 10 simultaneous identical requests from hitting upstream APIs |
| Per-Route Rate Limiting | Custom `quotaManager.js` with configurable windows per endpoint |
| Stream Concurrency | Semaphore at 30 parallel streams with graceful `503` fallback |
| Debug Endpoint | `GET /api/debug/quota` exposes quota, cache, inflight, and MongoDB health live |

---

## 🖥️ UI / UX Highlights

### Desktop
- **3-panel resizable layout** — drag dividers to adjust sidebar, content, and immersive panel widths
- **Immersive fullscreen panel**: animated album art, synced lyrics, and synchronized background music video
- **Waveform visualizer** with dynamic glow colors extracted from the album art (Color Thief)
- **FlowCast** section — curated themed music experiences
- **Right-click context menu** on every track (Play Next, Like, Add to Playlist, etc.)
- **Persistent bottom player** with seek bar and queue access

### Mobile
- Fully separate mobile-first UI (`/src/mobile/`)
- Swipeable screens: Home, Search, Library, Queue
- `LibraryScreen` with full artist search (JioSaavn proxy), saved albums, and related songs
- Native background playback with OS-level lock screen integration via `MediaSession`
- Smooth swipe gestures for track navigation

---

## 🧰 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & bundler |
| Zustand | Global state management |
| TanStack Query | Server state caching/sync |
| Framer Motion | Animations & transitions |
| Tailwind CSS 3 | Utility-first styling |
| Firebase Auth + Firestore | Auth & user data persistence |
| Howler.js | Local audio engine |
| WaveSurfer.js | Waveform visualization |
| Color Thief | Dynamic theme extraction from album art |
| Swiper.js | Mobile carousel |
| vite-plugin-pwa | Progressive Web App manifest & service worker |

### Backend
| Technology | Purpose |
|---|---|
| Express 5 | HTTP server |
| @distube/ytdl-core | YouTube audio stream extraction |
| youtubei.js | Zero-quota YouTube search & related videos |
| play-dl | Secondary YouTube stream fallback |
| firebase-admin | Server-side Firebase access |
| mongoose + MongoDB Atlas | Behavioral event storage |
| Pinecone | Vector database for recommendation embeddings |
| cheerio | Lyrics scraping from Genius |
| Multer | Multipart file upload (audio detection) |
| compression | Gzip middleware |

### ML Worker
| Technology | Purpose |
|---|---|
| FastAPI | Python HTTP service |
| SentenceTransformers | Text-to-embedding model (`all-MiniLM-L6-v2`) |
| PyTorch | ML backend (single-threaded for Render free tier) |
| scikit-learn | Cosine similarity |
| NumPy | Embedding matrix operations |
| pymongo | MongoDB Atlas connection for profile data |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **MongoDB Atlas** URI
- **Firebase** project (Auth + Firestore enabled)
- **RapidAPI** key (Shazam)
- **Genius API** token (lyrics)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Sachin-pandey13/Melopra-.git
cd Melopra-
```

---

### 2. Backend Setup

```bash
# Install root dependencies
npm install

# Create environment file
cp .env.example .env
```

Configure `.env` at the project root:

```env
PORT=4000
ACOUSTID_KEY=your_acoustid_key
GENIUS_TOKEN=your_genius_api_token
RAPIDAPI_KEY=your_rapidapi_key
FIREBASE_SERVICE_ACCOUNT=./serviceAccountKey.json
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/melopra
MELO_API_URL=http://localhost:5001
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=your_index_name
```

```bash
# Start the backend
npm start
# Server running on http://localhost:4000
```

---

### 3. Frontend Setup

```bash
cd client
npm install

# Create environment file
cp .env.example .env
```

Configure `client/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender
VITE_FIREBASE_APP_ID=your_app_id
```

```bash
npm run dev
# App running on http://localhost:5173
```

---

### 4. ML Worker Setup

```bash
cd ml_worker
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Start the ML worker
uvicorn recommender:app --port 5001 --reload
# ML API running on http://localhost:5001
```

> **Note:** The `song_embeddings.npy` and `song_metadata.json` files must be present in `ml_worker/`. These are pre-generated by `youtube_to_firebase_tagged.py`. They are large files and may not be in the repository — contact the maintainer or regenerate them.

---

## 📁 Project Structure

```
melopra/
├── server.js                    # Main Express backend (629 lines)
├── server/
│   ├── routes/
│   │   ├── recommendations.js   # Pinecone ML recs proxy
│   │   ├── personalized.js      # /personalized-feed & /user-taste
│   │   └── flowcast.js          # Themed music experiences
│   ├── cache.js                 # TTL cache store
│   ├── inflight.js              # In-flight request dedup
│   ├── quotaManager.js          # Per-route rate limiter
│   ├── mongodb.js               # Mongoose schemas & connection
│   ├── userProfileAggregator.js # Debounced ML profile rebuild
│   └── firebaseAdmin.js         # Firebase Admin SDK init
│
├── ml_worker/
│   ├── recommender.py           # FastAPI app + /recommend endpoint
│   ├── personalized_recommender.py  # /personalized-recommend endpoint
│   ├── generate_embedding.py    # Embedding pre-computation script
│   ├── youtube_to_firebase_tagged.py # Song metadata crawler/tagger
│   ├── song_embeddings.npy      # Pre-computed 384-dim vectors (10K+ songs)
│   ├── song_metadata.json       # Song catalog (~2.8MB)
│   └── requirements.txt
│
└── client/
    ├── src/
    │   ├── layouts/
    │   │   ├── DesktopHome.jsx  # Main desktop orchestrator (~2000 lines)
    │   │   ├── LeftSidebar.jsx
    │   │   ├── CenterPanel.jsx
    │   │   ├── RightPanel.jsx
    │   │   └── Overlays.jsx
    │   ├── mobile/
    │   │   ├── MobileHome.jsx
    │   │   └── screens/
    │   │       ├── HomeScreen.jsx
    │   │       ├── SearchScreen.jsx
    │   │       ├── LibraryScreen.jsx    # Full artist search + library
    │   │       ├── ArtistSearchPage.jsx
    │   │       └── QueueScreen.jsx
    │   ├── components/
    │   │   ├── ImmersivePanel.jsx   # Full-screen player with lyrics + video
    │   │   ├── Header.jsx           # Search & navigation header
    │   │   ├── SongProgressBar.jsx  # Unified seek bar (audio + YouTube)
    │   │   ├── LiveAlbumArt.jsx     # Dynamic spinning album art
    │   │   ├── WaveformVisualizer.jsx
    │   │   ├── DetectMusic.jsx      # Shazam-powered song detection
    │   │   ├── HummingSearch.jsx    # Humming search (CLAP/FAISS ready)
    │   │   └── OnboardingPage.jsx   # First-run taste profiling
    │   ├── hooks/
    │   │   ├── useQueueManager.js
    │   │   ├── usePlayerController.js
    │   │   └── useLibraryController.js
    │   ├── api/
    │   │   ├── getRecommendations.js
    │   │   ├── getPersonalizedFeed.js
    │   │   └── logUserEvent.js
    │   └── utils/
    │       └── listeningMemory.js   # Decay-weighted listening memory
    └── vite.config.mjs
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/ping` | Connectivity + env validation |
| `POST` | `/api/detect` | Song detection (Shazam) — audio upload |
| `GET` | `/api/lyrics?q=` | Lyrics via Genius + scraping |
| `GET` | `/api/stream?id=` | Chunked YouTube audio stream |
| `GET` | `/api/yt-search?q=&limit=` | YouTube search (zero quota) |
| `GET` | `/api/yt-related?id=` | Related YouTube videos |
| `GET` | `/api/artist-search?artist=` | Artist search via JioSaavn |
| `GET` | `/api/artist-image/:id` | Deezer artist image proxy |
| `POST` | `/api/log_event` | Log user behavioural event |
| `GET` | `/api/personalized-feed` | Personalized homepage feed |
| `GET` | `/api/user-taste` | User taste profile data |
| `GET` | `/api/debug/quota` | Live quota, cache, DB status |
| `POST` | `/api/flowcast/*` | FlowCast themed music routes |

### ML Worker
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/recommend` | Content-based song recommendations |
| `POST` | `/personalized-recommend` | Behavioural personalized recommendations |

---

## 🚢 Deployment

### Frontend → Vercel
```bash
cd client
npm run build
# Deploy dist/ to Vercel
# Set all VITE_* env vars in Vercel dashboard
```

The `client/vercel.json` handles SPA routing rewrites.

### Backend → Render
- Set all environment variables in Render dashboard
- Start command: `node server.js`
- The backend auto-connects to MongoDB Atlas on boot (non-blocking)

### ML Worker → Render
- Runtime: Python 3.10+
- Start command: `uvicorn recommender:app --host 0.0.0.0 --port $PORT`
- Pre-load `song_embeddings.npy` and `song_metadata.json` into the service

---

## 🗺️ Roadmap

- [ ] **Humming Search** — Complete CLAP/OpenL3 embeddings + FAISS index integration
- [ ] **Offline Mode** — Full PWA with service worker song caching
- [ ] **Premium Downloads** — Legal region-based offline song downloads
- [ ] **Social Features** — Share playlists, collaborative listening sessions
- [ ] **Voice Commands** — Natural language song requests
- [ ] **Podcast Support** — RSS-based podcast player integration
- [ ] **Desktop App** — Electron wrapper for native OS integration
- [ ] **Multiple Languages** — i18n support for global audience

---

## 🤝 Contributing

Contributions are welcome and encouraged. This is a serious project — please bring serious PRs.

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request with a detailed description

Please follow the existing code style. Prefer functional components, custom hooks, and modular server routes.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🙏 Acknowledgments

- [SentenceTransformers](https://www.sbert.net/) — for the powerful `all-MiniLM-L6-v2` model
- [youtubei.js](https://github.com/LuanRT/YouTube.js) — zero-quota YouTube access
- [play-dl](https://github.com/play-dl/play-dl) — reliable audio stream extraction
- [Pinecone](https://www.pinecone.io/) — vector similarity search infrastructure
- [Firebase](https://firebase.google.com/) — auth and realtime database
- [MongoDB Atlas](https://www.mongodb.com/atlas) — behavioral data persistence
- [Shazam via RapidAPI](https://rapidapi.com/apidojo/api/shazam/) — song recognition engine
- [JioSaavn](https://www.jiosaavn.com/) — keyless artist search API

---

<div align="center">

<br/>

**Built with obsession. Engineered for scale. Designed for discovery.**

<br/>

[![GitHub stars](https://img.shields.io/github/stars/Sachin-pandey13/Melopra-?style=for-the-badge&color=6d28d9)](https://github.com/Sachin-pandey13/Melopra-/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Sachin-pandey13/Melopra-?style=for-the-badge&color=0ea5e9)](https://github.com/Sachin-pandey13/Melopra-/network)
[![GitHub issues](https://img.shields.io/github/issues/Sachin-pandey13/Melopra-?style=for-the-badge&color=f59e0b)](https://github.com/Sachin-pandey13/Melopra-/issues)

<br/>

*If Melopra impressed you, drop a ⭐ — it keeps the project alive.*

<br/>

</div>
