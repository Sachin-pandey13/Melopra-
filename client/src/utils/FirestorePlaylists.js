// src/utils/FirestorePlaylists.js
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

/**
 * Firestore layout (per user):
 * users/{uid}/playlists/{playlistId}            -> { id, name, createdAt }
 * users/{uid}/playlists/{playlistId}/tracks/{trackId} -> full track doc
 */

const playlistsCol = (userId) => collection(db, `users/${userId}/playlists`);
const playlistDoc = (userId, playlistId) =>
  doc(db, `users/${userId}/playlists/${playlistId}`);
const tracksCol = (userId, playlistId) =>
  collection(db, `users/${userId}/playlists/${playlistId}/tracks`);
const trackDoc = (userId, playlistId, trackId) =>
  doc(db, `users/${userId}/playlists/${playlistId}/tracks/${trackId}`);

const normalizeTrack = (track) => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  image: track.image || "",
  audio: track.audio || "",
  video: track.video || "",
  language: track.language || "",
  category: track.category || "",
  durationSec: track.durationSec || null,
  source: track.source || track.category || "Unknown",
  addedAt: Date.now(),
  order: track.order ?? null, // optional if you want ordering
});

/* --------------------------- Playlists CRUD --------------------------- */

export async function fetchPlaylists(userId) {
  const q = query(playlistsCol(userId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchPlaylistWithTracks(userId, playlistId) {
  const pSnap = await getDoc(playlistDoc(userId, playlistId));
  if (!pSnap.exists()) return null;

  const tSnap = await getDocs(tracksCol(userId, playlistId));
  const tracks = tSnap.docs.map((d) => d.data());

  return { id: pSnap.id, ...pSnap.data(), tracks };
}

export async function createPlaylist(userId, name) {
  const ref = doc(playlistsCol(userId)); // auto-id
  await setDoc(ref, {
    id: ref.id,
    name,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renamePlaylist(userId, playlistId, newName) {
  await updateDoc(playlistDoc(userId, playlistId), { name: newName });
}

export async function deletePlaylist(userId, playlistId) {
  // Delete the playlist doc; NOTE: Firestore doesn't cascade delete subcollections by default.
  // For production, consider a Cloud Function to recursively delete tracks subcollection.
  await deleteDoc(playlistDoc(userId, playlistId));
  // (Optional) Manually delete all tracks from the subcollection before deleting playlist
  // const tSnap = await getDocs(tracksCol(userId, playlistId));
  // await Promise.all(tSnap.docs.map((d) => deleteDoc(d.ref)));
}

/* --------------------------- Tracks in a playlist --------------------------- */

export async function fetchTracksFromPlaylist(userId, playlistId) {
  const snap = await getDocs(tracksCol(userId, playlistId));
  return snap.docs.map((d) => d.data());
}

export async function addTrackToPlaylist(userId, playlistId, track) {
  const normalized = normalizeTrack(track);
  await setDoc(trackDoc(userId, playlistId, track.id), normalized);
  return normalized;
}

export async function removeTrackFromPlaylist(userId, playlistId, trackId) {
  await deleteDoc(trackDoc(userId, playlistId, trackId));
}

export async function isTrackInPlaylist(userId, playlistId, trackId) {
  const t = await getDoc(trackDoc(userId, playlistId, trackId));
  return t.exists();
}

/**
 * Optional: Reorder tracks (simple swap by order field).
 * You need to store & maintain `order` in each track doc to use this.
 */
export async function updateTrackOrder(userId, playlistId, orderedTrackIds) {
  // orderedTrackIds: [trackId1, trackId2, ...]
  await Promise.all(
    orderedTrackIds.map((id, idx) =>
      updateDoc(trackDoc(userId, playlistId, id), { order: idx })
    )
  );
}
