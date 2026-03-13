import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export default function useFirestoreProfileImage(uid) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setImageUrl(data.profileImage || null);
      }
    };

    fetchProfile();
  }, [uid]);

  return imageUrl;
}
