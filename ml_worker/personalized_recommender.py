# ml_worker/personalized_recommender.py
# ─────────────────────────────────────────────────────────────
# Extends the existing recommender.py with a personalized
# /personalized-recommend endpoint.
#
# Strategy:
#   1. Use user's top artists / languages as soft filters
#   2. Boost scores for preferred artists (+0.12) and languages (+0.08)
#   3. Exclude recently played song IDs
#   4. Return top-N results ranked by boosted cosine similarity
#
# This file is IMPORTED by recommender.py using:
#   from personalized_recommender import router as personal_router
#   app.include_router(personal_router)
# ─────────────────────────────────────────────────────────────

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

router = APIRouter()

# ── These are injected by recommender.py at import time ──────
_songs      = None   # list of song dicts
_embeddings = None   # (N, 384) numpy array


def inject_data(songs, embeddings):
    """Called by recommender.py to share loaded data with this module."""
    global _songs, _embeddings
    _songs      = songs
    _embeddings = embeddings


# ── Request schema ────────────────────────────────────────────
class PersonalizedRequest(BaseModel):
    userId:      str       = ""
    topArtists:  List[str] = []
    topLangs:    List[str] = []
    topGenres:   List[str] = []
    excludeIds:  List[str] = []
    limit:       int       = 20


# ── Personalized recommendation endpoint ─────────────────────
@router.post("/personalized-recommend")
def personalized_recommend(req: PersonalizedRequest):
    if _songs is None or _embeddings is None:
        return {"songs": [], "error": "Model not loaded"}

    # Normalise inputs for fast lookup
    pref_artists = {a.lower() for a in req.topArtists}
    pref_langs   = {l.lower() for l in req.topLangs}
    pref_genres  = {g.lower() for g in req.topGenres}
    exclude_set  = set(req.excludeIds)

    # ── If we have preferred artists, build a taste centroid ────
    # Average the embeddings of songs by preferred artists to get
    # a "taste vector" that represents the user's musical centre of gravity
    taste_indices = [
        i for i, s in enumerate(_songs)
        if s.get("artist", "").lower() in pref_artists
    ]

    if taste_indices:
        taste_vector = _embeddings[taste_indices].mean(axis=0, keepdims=True)
    else:
        # Cold path — use language/genre average as weak signal
        taste_vector = _embeddings.mean(axis=0, keepdims=True)

    # Cosine similarity against the taste centroid
    sims = cosine_similarity(taste_vector, _embeddings)[0]

    results       = []
    used_titles   = set()
    artist_counts = {}

    MAX_PER_ARTIST = 3   # slightly more generous in personalized mode

    for idx in sims.argsort()[::-1]:
        candidate = _songs[idx]

        song_id  = str(candidate.get("id", ""))
        title    = candidate.get("title", "")
        artist   = candidate.get("artist", candidate.get("channel", "")).lower()
        language = candidate.get("language", "").lower()
        category = candidate.get("category", candidate.get("genre", "")).lower()

        # Skip excluded (recently played) songs
        if song_id in exclude_set:
            continue

        # Skip duplicate titles
        if title.lower() in used_titles:
            continue

        # Artist diversity cap
        artist_counts[artist] = artist_counts.get(artist, 0)
        if artist_counts[artist] >= MAX_PER_ARTIST:
            continue

        # ── Personalisation boosts ────────────────────────────────
        score = float(sims[idx])

        if artist in pref_artists:
            score += 0.12   # preferred artist boost

        if language in pref_langs:
            score += 0.08   # preferred language boost

        if category in pref_genres:
            score += 0.05   # preferred genre boost

        artist_counts[artist] += 1
        used_titles.add(title.lower())

        results.append({
            "id":         song_id,
            "title":      title,
            "artist":     candidate.get("artist", candidate.get("channel", "")),
            "language":   candidate.get("language", ""),
            "category":   candidate.get("category", candidate.get("genre", "")),
            "thumbnail":  candidate.get("thumbnail", ""),
            "youtubeUrl": f"https://www.youtube.com/watch?v={song_id}",
            "score":      round(score, 4),
        })

        if len(results) >= req.limit:
            break

    # Sort final results by boosted score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    return {"songs": results, "personalized": True}
