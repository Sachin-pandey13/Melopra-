// components/FirestoreImage.jsx
import { useEffect, useState } from "react";
import { getDoc, doc, getFirestore } from "firebase/firestore";

const FirestoreImage = ({ uid, fallbackLetter }) => {
  const [profileUrl, setProfileUrl] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists() && userDoc.data().profileImage) {
          setProfileUrl(userDoc.data().profileImage);
        }
      } catch (err) {
        console.error("Error loading Firestore profile image:", err);
      }
    };
    if (uid) fetchImage();
  }, [uid]);

  if (profileUrl) {
    return (
      <img
        src={profileUrl}
        alt="Profile"
        className="w-full h-full object-cover rounded-full"
      />
    );
  }

  return fallbackLetter || "U";
};

export default FirestoreImage;
