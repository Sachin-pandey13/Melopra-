// /src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { auth, setUpRecaptcha } from "../firebase"; // <-- Added import

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email/Password login
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Email/Password signup
  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  // Google Authentication
  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  // 📱 Phone Authentication - Send OTP
  function loginWithPhone(phoneNumber) {
    return setUpRecaptcha(phoneNumber);
  }

  // 📱 Phone Authentication - Verify OTP
  function verifyOtp(confirmationResult, otp) {
    return confirmationResult.confirm(otp);
  }

  // Logout
  function logout() {
    return signOut(auth);
  }

  // Track current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    signup,
    logout,
    loginWithGoogle,
    loginWithPhone,   // <-- Added
    verifyOtp,        // <-- Added
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
