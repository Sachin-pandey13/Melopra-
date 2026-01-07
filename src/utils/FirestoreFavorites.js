// src/utils/FirestoreFavorites.js
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

const favCol = (userId) => collection(db, `users/${userId}/favorites`);
const favDoc = (userId, albumId) => doc(db, `users/${userId}/favorites/${albumId}`);

const albumToFavDoc = (album) => ({
  id: album.id,
  title: album.title,
  artist: album.artist,
  image: album.image || "",
  audio: album.audio || "",
  video: album.video || "",
  language: album.language || "",
  category: album.category || "",
  createdAt: Date.now(),
});

export async function fetchFavorites(userId) {
  const snap = await getDocs(favCol(userId));
  return snap.docs.map((d) => d.data());
}

export async function addFavorite(userId, album) {
  await setDoc(favDoc(userId, album.id), albumToFavDoc(album));
}

export async function removeFavorite(userId, albumId) {
  await deleteDoc(favDoc(userId, albumId));
}
