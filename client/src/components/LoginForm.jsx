import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import PhoneLogin from "./PhoneLogin";

const LoginForm = ({ onClose }) => {
  const {
    signup,
    login,
    loginWithGoogle,

    // 🔑 NEW from AuthContext
    getSignInMethods,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login | signup
  const [error, setError] = useState("");
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        // 🔑 CHECK PROVIDERS FIRST
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
    <div className="bg-zinc-900 text-white p-6 rounded-xl shadow-lg w-full max-w-sm">
      <h2 className="text-2xl font-bold text-center mb-4">
        {mode === "login" ? "Log In" : "Sign Up"}
      </h2>

      {error && (
        <p className="text-red-400 mb-2 text-center text-sm">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full px-3 py-2 bg-white/10 text-white rounded focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full px-3 py-2 bg-white/10 text-white rounded focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded transition disabled:opacity-60"
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Log In"
            : "Sign Up"}
        </button>
      </form>

      <div className="flex items-center my-4 gap-2">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-gray-400 text-sm">
          or continue with
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full bg-white/10 hover:bg-white/20 py-2 rounded mb-2 disabled:opacity-60"
      >
        Continue with Google
      </button>

      <button
        onClick={() => setShowPhoneLogin(true)}
        className="w-full bg-white/10 hover:bg-white/20 py-2 rounded"
      >
        Login with Phone
      </button>

      <div className="mt-4 text-center text-sm text-gray-400">
        {mode === "login" ? (
          <>
            Don't have an account?
            <button
              onClick={() => setMode("signup")}
              className="text-purple-400 ml-1 hover:underline"
            >
              Sign Up
            </button>
          </>
        ) : (
          <>
            Already have an account?
            <button
              onClick={() => setMode("login")}
              className="text-purple-400 ml-1 hover:underline"
            >
              Log In
            </button>
          </>
        )}
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full text-sm text-gray-400 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
};

export default LoginForm;
