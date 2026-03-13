// src/utils/FirestoreFollowedArtists.js
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

const artistsCol = (userId) =>
  collection(db, `users/${userId}/followedArtists`);
const artistDoc = (userId, artistId) =>
  doc(db, `users/${userId}/followedArtists/${artistId}`);

const normalizeArtist = (artist) => ({
  id: artist.id || artist.channelId || `artist-${Date.now()}`,
  name: artist.name || artist.artist || "Unknown Artist",
  image: artist.image || artist.thumbnail || "",
  channelId: artist.channelId || artist.id || "",
  followedAt: Date.now(),
});

export async function fetchFollowedArtists(userId) {
  const snap = await getDocs(artistsCol(userId));
  return snap.docs.map((d) => d.data());
}

export async function followArtist(userId, artist) {
  const normalized = normalizeArtist(artist);
  await setDoc(artistDoc(userId, normalized.id), normalized);
  return normalized;
}

export async function unfollowArtist(userId, artistId) {
  await deleteDoc(artistDoc(userId, artistId));
}
