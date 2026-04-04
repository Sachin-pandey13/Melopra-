import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import json
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

import torch
torch.set_num_threads(1)

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# 🎯 Personalized recommender (additive — does not change existing /recommend)
from personalized_recommender import router as personal_router, inject_data

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

print("⏳ Loading model...")
model = SentenceTransformer(MODEL_NAME)
print("✅ Model loaded")

print("⏳ Loading embeddings...")
embeddings = np.load("song_embeddings.npy")
with open("song_metadata.json", "r", encoding="utf-8") as f:
    songs = json.load(f)
print(f"✅ Embeddings + metadata loaded | Total songs: {len(songs)}")

app = FastAPI()

# 🎯 Share loaded data with personalized module
inject_data(songs, embeddings)

# 🎯 Mount personalized routes (/personalized-recommend)
app.include_router(personal_router)


# -----------------------------
# Request Schema
# -----------------------------
class SongInput(BaseModel):
    title: str = ""
    artist: str = ""
    language: str = ""
    category: str = ""
    tags: list[str] = []


# -----------------------------
# Convert Input Song to Text
# -----------------------------
def song_to_text(song: SongInput):
    return f"""
    Title: {song.title}
    Artist: {song.artist}
    Language: {song.language}
    Category: {song.category}
    Tags: {' '.join(song.tags)}
    """


# -----------------------------
# Recommendation Endpoint
# -----------------------------
@app.post("/recommend")
def recommend(song: SongInput):
    query_text = song_to_text(song)

    # Generate embedding
    query_embedding = model.encode(
        [query_text],
        normalize_embeddings=True
    )

    # Cosine similarity
    sims = cosine_similarity(query_embedding, embeddings)[0]

    # Sort by similarity
    top_indices = sims.argsort()[::-1]

    results = []
    used_titles = set()
    artist_counter = {}

    MAX_RESULTS = 20
    MAX_PER_ARTIST = 2

    seed_language = (song.language or "").lower()
    seed_category = (song.category or "").lower()

    for idx in top_indices:
        candidate = songs[idx]

        title = candidate.get("title", "")
        artist = candidate.get("artist", "").lower()
        language = candidate.get("language", "").lower()
        category = candidate.get("category", "").lower()

        # Skip same song
        if title.lower() == song.title.lower():
            continue

        # Avoid duplicate titles
        if title in used_titles:
            continue

        # Language filter (strict if provided)
        if seed_language and language and language != seed_language:
            continue

        # Genre/category boost (soft filter)
        score = sims[idx]
        if seed_category and category == seed_category:
            score += 0.05  # small boost

        # Artist diversity control
        if artist not in artist_counter:
            artist_counter[artist] = 0

        if artist_counter[artist] >= MAX_PER_ARTIST:
            continue

        artist_counter[artist] += 1
        used_titles.add(title)

        results.append({
            "id": candidate.get("id"),
            "title": title,
            "artist": candidate.get("artist"),
            "language": candidate.get("language"),
            "category": candidate.get("category"),
            "score": float(score)
        })

        if len(results) >= MAX_RESULTS:
            break

    return {"songs": results}