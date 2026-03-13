import React, { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import PhoneLogin from "./PhoneLogin";

const LoginModal = ({ onClose }) => {
  const {
    login,
    signup,
    loginWithGoogle,

    // 🔑 NEW
    getSignInMethods,
  } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef();
  const passwordRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const email = emailRef.current.value;
    const password = passwordRef.current.value;

    try {
      if (!isSignup) {
        // 🔑 CHECK PROVIDERS BEFORE LOGIN
        const methods = await getSignInMethods(email);

        if (
          methods.includes("google.com") &&
          !methods.includes("password")
        ) {
          setError(
            "This account uses Google sign-in. Please continue with Google or set a password."
          );
          setLoading(false);
          return;
        }

        await login(email, password);
      } else {
        await signup(email, password);
      }

      onClose();
    } catch (err) {
      setError(
        err?.code === "auth/wrong-password"
          ? "Incorrect password."
          : err?.code === "auth/user-not-found"
          ? "No account found with this email."
          : err?.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      await loginWithGoogle();
      onClose();
    } catch {
      setError("Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (showPhoneLogin) {
    return <PhoneLogin onClose={() => setShowPhoneLogin(false)} />;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl w-[90%] max-w-md relative">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-red-400 text-xl"
        >
          ✖
        </button>

        {/* Header */}
        <h2 className="text-3xl font-bold text-center mb-6 text-white">
          {isSignup ? "Create Account" : "Log In"}
        </h2>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-center mb-3 text-sm">
            {error}
          </p>
        )}

        {/* Email + Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            ref={emailRef}
            placeholder="Email"
            required
            className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none"
          />

          <input
            type="password"
            ref={passwordRef}
            placeholder="Password"
            required
            className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 transition text-white font-medium py-3 rounded-lg disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isSignup
              ? "Sign Up"
              : "Log In"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-4 gap-2">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-gray-400 text-sm">or continue with</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Provider Buttons */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg mb-3 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setShowPhoneLogin(true)}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg mb-3"
        >
          Login with Phone
        </button>

        {/* Mode Switch */}
        <p className="text-center text-sm mt-3 text-gray-400">
          {isSignup ? "Already have an account?" : "Don't have an account?"}
          <button
            className="text-purple-400 ml-1 hover:underline"
            onClick={() => setIsSignup(!isSignup)}
          >
            {isSignup ? "Log In" : "Sign Up"}
          </button>
        </p>

      </div>
    </div>
  );
};

export default LoginModal;
