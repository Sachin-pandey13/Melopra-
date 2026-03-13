import json
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

print("⏳ Loading model...")
model = SentenceTransformer(MODEL_NAME)
print("✅ Model loaded")

# Load songs
with open("song_metadata.json", "r", encoding="utf-8") as f:
    songs = json.load(f)

def song_to_text(song):
    return f"""
    Title: {song.get('title','')}
    Artist: {song.get('channel','')}
    Description: {song.get('description','')}
    Tags: {' '.join(song.get('tags', []))}
    """

texts = [song_to_text(song) for song in songs]

print("⏳ Generating embeddings...")
embeddings = model.encode(
    texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True
)

np.save("song_embeddings.npy", embeddings)

print("🔥 Embeddings saved to song_embeddings.npy")
print("Total songs:", len(songs))