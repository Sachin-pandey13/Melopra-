import os
import time
import json
import re
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

import gc
import tempfile
from pathlib import Path


# === Load environment variables ===
load_dotenv()
print("🎯 Loaded ACOUSTID_API_KEY:", os.getenv("ACOUSTID_API_KEY"))
YOUTUBE_API_KEYS = [
    os.getenv("YOUTUBE_API_KEY"),
    os.getenv("YOUTUBE_API_KEY_ALT")
]
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_CRED_PATH", "serviceAccountKey.json")


# === Voice stability globals ===
LAST_COMMAND = ""
LAST_COMMAND_TIME = 0
VOICE_STABILITY_WINDOW = 1.2  # seconds



# === Config ===
CACHE_FILE = "song_cache.json"
RETRY_COOLDOWN = 60 * 5

current_key_index = 0
local_cache = {}
quota_exceeded_keys = set()

# === Song Queue (server-side) ===
SONG_QUEUE = []
CURRENT_SONG = None

# === Initialize Firebase (admin service account — full access server-side) ===
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
db = firestore.client()

# === Helper: Cache ===
def load_cache():
    global local_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                local_cache = json.load(f)
        except json.JSONDecodeError:
            local_cache = {}
    else:
        local_cache = {}

def save_cache():
    with open(CACHE_FILE, "w") as f:
        json.dump(local_cache, f, indent=4)

# === Initialize YouTube API ===
def get_youtube_client():
    global current_key_index
    api_key = YOUTUBE_API_KEYS[current_key_index]
    return build("youtube", "v3", developerKey=api_key)

youtube = get_youtube_client()

# === Rotate API Key ===
def rotate_api_key():
    global current_key_index, youtube, quota_exceeded_keys
    quota_exceeded_keys.add(current_key_index)
    available_keys = [i for i in range(len(YOUTUBE_API_KEYS)) if i not in quota_exceeded_keys]

    if not available_keys:
        print(f"😴 All API keys hit quota. Cooling down for {RETRY_COOLDOWN // 60} min...")
        time.sleep(RETRY_COOLDOWN)
        quota_exceeded_keys.clear()
        available_keys = [0]

    current_key_index = available_keys[0]
    print(f"🔄 Switching to YouTube API key #{current_key_index + 1}")
    youtube = get_youtube_client()

# === YouTube Search (returns normalized song_data with thumbnail/image) ===
def search_youtube_song(query):


    key = query.lower().strip()
    if key in local_cache:
        print(f"⚡ Cached: {local_cache[key].get('title')}")
        return local_cache[key]

    try:
        request = youtube.search().list(
    q=query,
    part="snippet",
    type="video",
    videoCategoryId="10",  # Music
    maxResults=1
)

        response = request.execute()

        if not response.get("items"):
            print("⚠️ No results for:", query)
            return None

        video = response["items"][0]
        video_id = video["id"].get("videoId")
        snippet = video.get("snippet", {})
        title = snippet.get("title", "")
        channel = snippet.get("channelTitle", "")
        thumbnails = snippet.get("thumbnails", {})
        thumbnail = thumbnails.get("high", {}).get("url") or thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url")

        song_data = {
            "video_id": video_id,
            "title": title,
            "artist": channel,
            "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
            "thumbnail": thumbnail,
            "image": thumbnail,  # keep both keys for frontend compatibility
            "category": "YouTube",
        }

        local_cache[key] = song_data
        save_cache()
        return song_data

    except HttpError as e:
        try:
            status = e.resp.status
        except Exception:
            status = None
        if status == 403:
            print("🚫 Quota hit, rotating key...")
            rotate_api_key()
            return search_youtube_song(query)
        else:
            print("❌ YouTube API error:", e)
            return None
    except Exception as e:
        print("❌ Unexpected YouTube error:", e)
        return None

# === Firebase storage helpers ===
def add_song_to_firebase(song_data):
    if not song_data or not song_data.get("video_id"):
        return

    try:
        ref = db.collection("songs").document(song_data["video_id"])
        if ref.get().exists:
            return  # ✅ already stored

        ref.set(song_data)
        print(f"✅ Saved to Firebase: {song_data.get('title')}")

    except Exception as e:
        print("❌ Firebase write error:", e)


def get_song_from_firebase(query):
    try:
        q = query.lower().strip()

        # 1️⃣ Exact video_id match
        doc = db.collection("songs").document(q).get()
        if doc.exists:
            return doc.to_dict()

        # 2️⃣ Exact title match (not substring)
        for doc in db.collection("songs").stream():
            data = doc.to_dict()
            if not data:
                continue

            title = data.get("title", "").lower().strip()
            artist = data.get("artist", "").lower().strip()

            if q == title or q == f"{title} by {artist}":
    
                return data

    except Exception as e:
        print("❌ Firebase read error:", e)

    return None



# === Playback / queue logic ===
# === Playback / queue logic ===
def play_song(query, set_current=True):
    global CURRENT_SONG

    print(f"\n🎤 User requested: {query}")
    if not query:
        return None

    # 1) Check Firebase FIRST
    song = get_song_from_firebase(query)
    if song:
        song = dict(song)            # never mutate Firestore data
        song["_source"] = "firebase"

        if set_current:              # ✅ CRITICAL FIX
            CURRENT_SONG = song

        print(f"▶️ Playing from Firebase: {song.get('url')}")
        return song

    # 2) Fallback to YouTube
    song = search_youtube_song(query)
    if song:
        song = dict(song)
        song["_source"] = "youtube"

        if set_current:              # ✅ CRITICAL FIX
            CURRENT_SONG = song

        # Store clean version in Firebase (no runtime fields)
        clean_song = dict(song)
        clean_song.pop("_source", None)
        add_song_to_firebase(clean_song)

        print(f"▶️ Playing from YouTube: {song.get('url')}")
        return song

    print("❌ Not found:", query)
    return None




# === Casual intent inference (fixed & strict) ===
def infer_intent(command):
    s = command.lower().strip()

    # next / play next
    if re.search(r"\b(next|after|play next|up next)\b", s):
        return "play_next"

    # add to queue
    if re.search(r"\b(add|queue|include|put)\b", s):
        return "add_to_queue"

    # playlist creation
    if re.search(r"\bplaylist\b", s):
        return "create_playlist"

    # pause
    if re.search(r"\b(pause|stop)\b", s):
        return "pause"

    # resume ONLY if command is exactly this
    if s in ("play", "resume", "start"):
        return "resume"

    # otherwise treat as song request
    if len(s) < 3:
        return "unknown"
    return "play_direct"

def is_stable_command(command: str) -> bool:
    global LAST_COMMAND, LAST_COMMAND_TIME

    now = time.time()
    cmd = command.lower().strip()

    # ignore very short garbage
    if len(cmd) < 3:
        return False

    # ignore rapid duplicate chunks
    if cmd == LAST_COMMAND and (now - LAST_COMMAND_TIME) < VOICE_STABILITY_WINDOW:
        return False

    LAST_COMMAND = cmd
    LAST_COMMAND_TIME = now
    return True


# === Flask setup ===
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/api/play-song", methods=["GET"])
def api_play_song():
    query = request.args.get("q")
    if not query:
        return jsonify({"error": "Missing query parameter ?q="}), 400

    print(f"🎤 API call received for: {query}")
    song = play_song(query)

    if song:
        return jsonify({
            "success": True,
            "song": song,
            "source": song.get("_source")  # ✅ single source of truth
        }), 200

    return jsonify({"success": False, "error": "Song not found"}), 404

# === Melo voice command endpoint (neutral/casual) ===
# === Melo voice command endpoint (neutral/casual) ===
@app.route("/api/melo", methods=["POST"])
def api_melo():
    global SONG_QUEUE, CURRENT_SONG
    try:
        data = request.get_json() or {}
        command = (data.get("command") or "").strip()

        if not command:
            return jsonify({
                "success": False,
                "reply": "Could you repeat that?"
            }), 400

        # 🔒 VOICE STABILITY GATE (CRITICAL FIX)
        if not is_stable_command(command):
            return jsonify({
                "success": False,
                "reply": "Listening…"
            }), 200

        print(f"🎙️ User said: {command}")
        intent = infer_intent(command)
        print(f"🧠 Inferred intent: {intent}")

        # --- Clean filler words but keep 'by' ---
        cleaned = re.sub(
            r"\b(please|could you|would you|hey|melo|song|track|music)\b",
            "",
            command,
            flags=re.I
        ).strip()

        if not cleaned:
            cleaned = command


        # ===== INTENT HANDLING =====
        # ===== INTENT HANDLING =====

        # --- PLAY NEXT ---
        if intent == "play_next":
            cleaned_query = re.sub(r"\bnext\b", "", cleaned, flags=re.I).strip()

            if len(cleaned_query) < 3:
                return jsonify({
                    "success": False,
                    "reply": "Say the full song name to play next"
                }), 200

            song = play_song(cleaned_query, set_current=False)
            if song:
                SONG_QUEUE.insert(0, song)
                return jsonify({
                    "success": True,
                    "reply": f"I’ll play {song.get('title')} next 🎶",
                    "song": song,
                    "queue": SONG_QUEUE,
                    "action": "play_next"
                }), 200

            return jsonify({
                "success": False,
                "reply": f"Couldn't find '{cleaned_query}'"
            }), 404


        # --- ADD TO QUEUE ---
        if intent == "add_to_queue":
            cleaned_query = re.sub(r"\b(add|queue|put)\b", "", cleaned, flags=re.I).strip()

            if len(cleaned_query) < 3:
                return jsonify({
                    "success": False,
                    "reply": "Say the full song name to add",
                    "action": "add_to_queue"
                }), 200

            song = play_song(cleaned_query, set_current=False)
            if not song:
                return jsonify({
                    "success": False,
                    "reply": f"Couldn't add '{cleaned_query}'"
                }), 404

            if any(s.get("video_id") == song.get("video_id") for s in SONG_QUEUE):
                return jsonify({
                    "success": True,
                    "reply": "Already in queue",
                    "queue": SONG_QUEUE,
                    "action": "add_to_queue"
                }), 200

            SONG_QUEUE.append(song)
            return jsonify({
                "success": True,
                "reply": f"Added {song.get('title')} to your queue 🎧",
                "song": song,
                "queue": SONG_QUEUE,
                "action": "add_to_queue"
            }), 200


        # --- CREATE PLAYLIST ---
        if intent == "create_playlist":
            playlist_name = re.sub(
                r"\b(create playlist|make playlist)\b",
                "",
                cleaned,
                flags=re.I
            ).strip() or "Untitled"

            return jsonify({
                "success": True,
                "reply": f"Playlist '{playlist_name}' created 🪩"
            }), 200


        # --- PAUSE ---
        if intent == "pause":
            return jsonify({
                "success": True,
                "reply": "Pausing playback",
                "action": "pause"
            }), 200


        # --- RESUME ---
        if intent == "resume":
            return jsonify({
                "success": True,
                "reply": "Resuming playback",
                "action": "resume"
            }), 200


        # --- PLAY DIRECT ---
        if intent == "play_direct":
            if len(cleaned) < 3:
                return jsonify({
                    "success": False,
                    "reply": "Say the full song name"
                }), 200

            song = play_song(cleaned)
            if song:
                return jsonify({
                    "success": True,
                    "reply": f"Playing {song.get('title')} by {song.get('artist')}",
                    "song": song,
                    "queue": SONG_QUEUE,
                    "action": "play_direct"
                }), 200

            return jsonify({
                "success": False,
                "reply": f"Sorry, couldn't find '{cleaned}'."
            }), 404


        # --- FALLBACK ---
        return jsonify({
            "success": False,
            "reply": "I didn’t understand that."
        }), 200

    except Exception as e:
        print("❌ Error in /api/melo:", e)
        return jsonify({
            "success": False,
            "reply": "Internal error.",
            "error": str(e)
        }), 500


# === Interests feed (server-side, NO API KEY LEAK) ===
@app.route("/api/interests", methods=["POST"])
def api_interests():
    try:
        data = request.get_json() or {}
        artists = data.get("artists", [])

        if not artists:
            return jsonify({ "blocks": [] }), 200

        blocks = []

        for item in artists:
            artist = item.get("artist")
            score = item.get("score", 0)

            if not artist or score < 2:
                continue

            query = f"{artist} official music"

            yt_res = youtube.search().list(
                q=query,
                part="snippet",
                type="video",
                videoCategoryId="10",  # music only
                maxResults=3
            ).execute()

            songs = []
            for it in yt_res.get("items", []):
                vid = it["id"].get("videoId")
                snippet = it.get("snippet", {})
                if not vid:
                    continue

                songs.append({
                    "id": vid,
                    "title": snippet.get("title"),
                    "artist": snippet.get("channelTitle"),
                    "image": snippet.get("thumbnails", {}).get("high", {}).get("url"),
                    "audio": f"https://www.youtube.com/watch?v={vid}",
                    "category": "YouTube"
                })

            if songs:
                blocks.append({
                    "artist": artist,
                    "songs": songs
                })

        return jsonify({ "blocks": blocks }), 200

    except Exception as e:
        print("❌ /api/interests error:", e)
        return jsonify({ "blocks": [] }), 500

# === Queue endpoints (frontend can poll / call these) ===
@app.route("/api/queue", methods=["GET", "POST", "DELETE"])
def api_queue():
    global SONG_QUEUE, CURRENT_SONG

    # ===== GET QUEUE =====
    if request.method == "GET":
        return jsonify({
            "current": CURRENT_SONG,
            "queue": SONG_QUEUE
        }), 200


    # ===== ADD TO QUEUE =====
    if request.method == "POST":
        data = request.get_json() or {}

        # Case 1: frontend sends a raw query string
        if isinstance(data, dict) and data.get("query"):
            song = play_song(data["query"], set_current=False)

            if not song:
                return jsonify({
                    "success": False,
                    "reply": "Song not found"
                }), 404

            SONG_QUEUE.append(song)
            return jsonify({
                "success": True,
                "song": song,
                "queue": SONG_QUEUE
            }), 200

        # Case 2: frontend sends a song object
        if isinstance(data, dict) and data.get("song"):
            song_obj = data["song"]
            title = song_obj.get("title")

            if not title:
                return jsonify({
                    "success": False,
                    "error": "Song title missing"
                }), 400

            # Always resolve through play_song
            found = play_song(title)
            if not found:
                return jsonify({
                    "success": False,
                    "reply": "Song not found"
                }), 404

            SONG_QUEUE.append(found)
            return jsonify({
                "success": True,
                "song": found,
                "queue": SONG_QUEUE
            }), 200

        return jsonify({
            "success": False,
            "error": "Invalid payload"
        }), 400


    # ===== CLEAR QUEUE =====
    if request.method == "DELETE":
        SONG_QUEUE = []
        return jsonify({
            "success": True,
            "reply": "Queue cleared",
            "queue": SONG_QUEUE
        }), 200

@app.route("/api/queue/next", methods=["POST"])
def api_queue_next():
    global SONG_QUEUE, CURRENT_SONG
    # pop next from queue (front)
    if not SONG_QUEUE:
        return jsonify({"success": False, "reply": "Queue is empty"}), 404
    next_song = SONG_QUEUE.pop(0)
    CURRENT_SONG = next_song
    # return the next song and remaining queue
    return jsonify({"success": True, "song": next_song, "queue": SONG_QUEUE}), 200

# === Server-side operations requiring admin privileges ===
@app.route("/api/like", methods=["POST"])
def api_like():
    """
    Accepts { userId: 'uid', song: { video_id/title/artist/thumbnail } }
    Adds server-side to users/{uid}/favorites collection.
    """
    try:
        data = request.get_json() or {}
        uid = data.get("userId")
        song = data.get("song")
        if not uid or not song:
            return jsonify({"success": False, "error": "Missing userId or song"}), 400

        fav_ref = db.collection("users").document(uid).collection("favorites").document(song.get("video_id") or str(time.time()))
        fav_ref.set({
            "title": song.get("title"),
            "artist": song.get("artist"),
            "video_id": song.get("video_id"),
            "url": song.get("url"),
            "thumbnail": song.get("thumbnail") or song.get("image")
        })
        return jsonify({"success": True, "reply": "Added to favorites"}), 200
    except Exception as e:
        print("❌ /api/like error:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/add-to-playlist", methods=["POST"])
def api_add_to_playlist():
    """
    Accepts { playlistId: 'id', song: {...} } and server-side updates playlist document.
    """
    try:
        data = request.get_json() or {}
        playlist_id = data.get("playlistId")
        song = data.get("song")
        if not playlist_id or not song:
            return jsonify({"success": False, "error": "Missing playlistId or song"}), 400

        pl_ref = db.collection("playlists").document(playlist_id)
        pl_snap = pl_ref.get()
        if not pl_snap.exists:
            return jsonify({"success": False, "error": "Playlist not found"}), 404

        pl_data = pl_snap.to_dict()
        songs = pl_data.get("songs", [])
        # avoid duplicates by video_id or title fallback
        if any((s.get("video_id") and s.get("video_id") == song.get("video_id")) or (s.get("title") == song.get("title")) for s in songs):
            return jsonify({"success": True, "reply": "Song already in playlist"}), 200

        songs.append(song)
        pl_ref.update({"songs": songs})
        return jsonify({"success": True, "reply": "Added to playlist"}), 200
    except Exception as e:
        print("❌ /api/add-to-playlist error:", e)
        return jsonify({"success": False, "error": str(e)}), 500

# === Simple control endpoints (inform frontend to pause/resume) ===
@app.route("/api/control", methods=["POST"])
def api_control():
    """
    Accepts { action: 'pause'|'resume' } - server returns acknowledgement; frontend should act.
    """
    try:
        data = request.get_json() or {}
        action = data.get("action")
        if action not in ("pause", "resume", "next"):
            return jsonify({"success": False, "error": "Invalid action"}), 400

        if action == "next":
            # pop next
            if not SONG_QUEUE:
                return jsonify({"success": False, "reply": "Queue empty"}), 404
            next_song = SONG_QUEUE.pop(0)
            global CURRENT_SONG
            CURRENT_SONG = next_song
            return jsonify({"success": True, "action": "next", "song": next_song, "queue": SONG_QUEUE}), 200

        return jsonify({"success": True, "action": action}), 200
    except Exception as e:
        print("❌ /api/control error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# ===== Add this block to youtube_to_firebase_tagged.py (paste BEFORE the app.run section) =====

import subprocess
import tempfile
import requests


# env vars for detection
ACOUSTID_API_KEY = os.getenv("ACOUSTID_API_KEY") or os.getenv("ACOUSTID_KEY") or os.getenv("ACOUSTID")
FPCALC_PATH = os.getenv("FPCALC_PATH", "fpcalc")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")

def run_fpcalc(filepath):
    """Run fpcalc and return parsed JSON result (fingerprint + duration)."""
    fpcalc_cmd = [FPCALC_PATH, "-json", filepath]
    try:
        res = subprocess.run(fpcalc_cmd, capture_output=True, text=True, check=True, timeout=30)
        return json.loads(res.stdout)
    except Exception as e:
        # try fallback without -json (older fpcalc versions)
        try:
            res = subprocess.run([FPCALC_PATH, filepath], capture_output=True, text=True, check=True, timeout=30)
            out = res.stdout
            # parse out Duration and Fingerprint
            dur = None
            fp = None
            for line in out.splitlines():
                if line.startswith("Duration:"):
                    dur = int(line.split(":",1)[1].strip())
                if line.startswith("Fingerprint:"):
                    fp = line.split(":",1)[1].strip()
            if fp and dur is not None:
                return {"fingerprint": fp, "duration": dur}
        except Exception as e2:
            print("fpcalc failed:", e, e2)
    return None

def ensure_wav_with_ffmpeg(in_path):
    """Convert input audio to a WAV that fpcalc accepts (44.1kHz, mono) using ffmpeg."""
    # create a temporary .wav file and immediately close the file descriptor
    out_fd, out_path = tempfile.mkstemp(suffix=".wav")
    os.close(out_fd)  # important: release file handle before ffmpeg uses it

    # ffmpeg command to convert input audio to a clean mono WAV
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-i", in_path,
        "-ar", "44100",
        "-ac", "1",
        "-vn",
        out_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=40)
        return out_path
    except subprocess.CalledProcessError as e:
        print("ffmpeg conversion failed:", e.stderr)
        return None
    except Exception as e:
        print("ffmpeg conversion error:", e)
        return None

def acoustid_lookup(fingerprint, duration):
    """Call AcoustID web service (v2 lookup) and return parsed results."""
    if not ACOUSTID_API_KEY:
        print("❌ ACOUSTID_API_KEY missing in environment.")
        return None

    url = "https://api.acoustid.org/v2/lookup"
    data = {
        "client": ACOUSTID_API_KEY,
        "fingerprint": fingerprint,
        "duration": int(duration),
        "meta": "recordings+releasegroups+sources+compress"
    }

    try:
        # ✅ Use POST instead of GET (fix for large fingerprints)
        r = requests.post(url, data=data, timeout=30)
        if r.status_code != 200:
            print(f"⚠️ AcoustID error {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        print("❌ AcoustID request failed:", e)
        return None

def fetch_musicbrainz_metadata(acoustid_id):
    """Fetch recording info from MusicBrainz if AcoustID has no title/artist."""
    try:
        url = f"https://musicbrainz.org/ws/2/recording/{acoustid_id}?fmt=json"
        headers = {"User-Agent": "MelopraMusic/1.0 (melopra@app.local)"}
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            data = r.json()
            title = data.get("title")
            artists = data.get("artist-credit", [])
            artist = ", ".join([a["name"] for a in artists if "name" in a])
            return {"title": title, "artist": artist}
    except Exception as e:
        print("⚠️ MusicBrainz fallback failed:", e)
    return None

from pathlib import Path
import tempfile


# === Combined GET + POST route for /api/detect_music ===
@app.route("/api/detect_music", methods=["GET", "POST"])
def detect_music():
    # --- Handle GET request (for browser info/testing) ---
    if request.method == "GET":
        return jsonify({
            "info": "POST an audio file (form-data, key 'audio') to this endpoint. Use POST to detect music.",
            "usage_example": "curl -F \"audio=@/path/to/file.mp3\" http://127.0.0.1:5001/api/detect_music"
        }), 200

    tmp_path = None
    wav_path = None

    try:
        if "audio" not in request.files:
            return jsonify({"success": False, "error": "Missing 'audio' file field"}), 400

        f = request.files["audio"]
        if f.filename == "":
            return jsonify({"success": False, "error": "Empty filename"}), 400

        # Save uploaded file to temp
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=Path(f.filename).suffix)
        os.close(tmp_fd)
        with open(tmp_path, "wb") as out:
            out.write(f.read())

        print(f"🎧 Uploaded file saved at: {tmp_path}")

        # Convert to WAV for fpcalc
        wav_path = ensure_wav_with_ffmpeg(tmp_path) or tmp_path
        print(f"🎼 Converted to WAV: {wav_path}")

        time.sleep(0.7)  # ensure ffmpeg releases handle

        # Run fpcalc
        fp_res = run_fpcalc(wav_path)
        if not fp_res:
            return jsonify({"success": False, "error": "Fingerprinting failed"}), 500

        fingerprint = fp_res.get("fingerprint")
        duration = fp_res.get("duration")

        if not fingerprint or not duration:
            return jsonify({"success": False, "error": "fpcalc returned incomplete data"}), 500

        print(f"🔍 Fingerprint generated, duration={duration}s")

        # --- Lookup AcoustID ---
        acoustid_res = acoustid_lookup(fingerprint, duration)
        if not acoustid_res or "results" not in acoustid_res or len(acoustid_res["results"]) == 0:
            print("❌ No AcoustID match found.")
            return jsonify({"success": False, "error": "No AcoustID match"}), 404

        print(f"🎯 AcoustID returned {len(acoustid_res['results'])} results")

        # --- Pick best match with recording details ---
        best = max(acoustid_res.get("results", []), key=lambda r: r.get("score", 0), default=None)
        best_score = best.get("score", 0) if best else 0
        title, artist, recording_id = None, None, None

        if best and "recordings" in best:
            recordings = best["recordings"]
            if recordings:
                rec = recordings[0]
                title = rec.get("title")
                rec_artists = rec.get("artists", [])
                if rec_artists:
                    artist = ", ".join([a.get("name") for a in rec_artists if a.get("name")])
                recording_id = rec.get("id")

        match_info = {
            "score": best_score,
            "title": title,
            "artist": artist,
            "recording_id": recording_id,
            "raw": best
        }

        # --- Fallback if title or artist missing ---
        if (not title or not artist):
            acoustid_id = best.get("id") if best else None
            if acoustid_id:
                print(f"🔄 Fetching fallback metadata from MusicBrainz for ID {acoustid_id}...")
                meta = fetch_musicbrainz_metadata(acoustid_id)
                if meta:
                    title = meta.get("title") or title
                    artist = meta.get("artist") or artist
                    match_info["title"] = title
                    match_info["artist"] = artist


        print(f"✅ Best match: {title} — {artist} (score: {best_score})")


        # --- YouTube search ---
        search_query = " ".join(filter(None, [title, artist]))
        youtube_song = search_youtube_song(search_query) if search_query else None
        print(f"▶️ YouTube result: {youtube_song.get('title') if youtube_song and isinstance(youtube_song, dict) else 'None'}")

        # --- Firestore save (optional) ---
        try:
            db.collection("detections").document(str(int(time.time()))).set({
                "timestamp": int(time.time()),
                "match": match_info,
                "search_query": search_query,
                "youtube": youtube_song or {}
            })
        except Exception as e:
            print("⚠️ Firestore write failed:", e)

        # --- Cleanup (Windows-safe) ---
        for _ in range(3):
            try:
                gc.collect()
                time.sleep(0.5)
                for p in [wav_path, tmp_path]:
                    if p and os.path.exists(p):
                        os.remove(p)
                print("🧹 Files cleaned successfully")
                break
            except PermissionError:
                print("⚠️ File in use, retrying cleanup...")
                time.sleep(0.5)
            except Exception as e:
                print("⚠️ Cleanup error:", e)
                break

        return jsonify({
            "success": True,
            "match": match_info,
            "youtube": youtube_song
        }), 200

    except Exception as e:
        print("❌ /api/detect_music error:", e)
        return jsonify({"success": False, "error": str(e)}), 500




# === Run Flask ===
if __name__ == "__main__":
    load_cache()
    print("🚀 Melo AI Flask server running on port 5001...")
    app.run(host="0.0.0.0", port=5001)
