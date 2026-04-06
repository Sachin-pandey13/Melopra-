// /src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,

  // 🔑 ADDED
  EmailAuthProvider,
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from "firebase/auth";

import { auth, setUpRecaptcha } from "../firebase";
import { clearPlayerState } from "../mobile/state/useNowPlaying";
import { usePlayerStore } from "../stores/usePlayerStore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- EMAIL / PASSWORD ---------------- */

  function login(email, password) {
    return signInWithEmailAndPassword(
      auth,
      email.trim(),
      password.trim()
    );
  }

  function signup(email, password) {
    return createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password.trim()
    );
  }

  /* ---------------- GOOGLE AUTH ---------------- */

  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  /* ---------------- 🔑 NEW: LINK PASSWORD TO GOOGLE USER ---------------- */

  async function linkPasswordToGoogleUser(email, password) {
    if (!auth.currentUser) {
      throw new Error("No authenticated user to link password");
    }

    const credential = EmailAuthProvider.credential(
      email.trim(),
      password.trim()
    );

    return linkWithCredential(auth.currentUser, credential);
  }

  /* ---------------- 🔑 NEW: CHECK PROVIDERS FOR EMAIL ---------------- */

  function getSignInMethods(email) {
    return fetchSignInMethodsForEmail(auth, email.trim());
  }

  /* ---------------- PHONE AUTH ---------------- */

  function loginWithPhone(phoneNumber) {
    return setUpRecaptcha(phoneNumber);
  }

  function verifyOtp(confirmationResult, otp) {
    return confirmationResult.confirm(otp);
  }

  /* ---------------- LOGOUT ---------------- */

  function logout() {
    clearPlayerState();
    usePlayerStore.setState({ currentTrack: null, queue: [], isPlaying: false });
    return signOut(auth);
  }

  /* ---------------- AUTH STATE ---------------- */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /* ---------------- CONTEXT VALUE ---------------- */

  const value = {
    currentUser,

    // existing
    login,
    signup,
    logout,
    loginWithGoogle,
    loginWithPhone,
    verifyOtp,

    // 🔑 NEW (DO NOT REMOVE)
    linkPasswordToGoogleUser,
    getSignInMethods,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
