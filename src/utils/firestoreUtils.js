import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

export const fetchFirestoreAlbums = async () => {
  const q = query(collection(db, "songs"), orderBy("title", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const deleteAlbumFromFirestore = async (id) => {
  await deleteDoc(doc(db, "songs", id));
};
