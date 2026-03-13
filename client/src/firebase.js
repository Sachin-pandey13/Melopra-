// src/firebase.js (RECOMMENDED filename)
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCoLx-CILAz1SqRkJ-PpOt-FYfGgZ9xeO8", // ← you will add your key
  authDomain: "melopra-4a483.firebaseapp.com",
  projectId: "melopra-4a483",
  storageBucket: "melopra-4a483.appspot.com", // ✅ fix: was ".app", should be ".appspot.com"
  messagingSenderId: "987483771900",
  appId: "1:987483771900:web:1e489c2e8f74f522f65879",
};

const app = initializeApp(firebaseConfig);

// Auth & DB
export const auth = getAuth(app);
export const db = getFirestore(app);

// Phone Auth + Invisible Recaptcha
export const setUpRecaptcha = (phone) => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      "recaptcha-container",
      { size: "invisible" },
      auth
    );
  }

  return signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
};
