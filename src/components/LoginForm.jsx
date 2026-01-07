import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import PhoneLogin from "./PhoneLogin";

const LoginForm = ({ onClose }) => {
  const { signup, login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login or signup
  const [error, setError] = useState("");
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      setError("Google login failed.");
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

      {error && <p className="text-red-400 mb-2 text-center text-sm">{error}</p>}

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
          className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded transition"
        >
          {mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </form>

      <div className="flex items-center my-4 gap-2">
        <div className="flex-1 h-px bg-white/10"></div>
        <span className="text-gray-400 text-sm">or continue with</span>
        <div className="flex-1 h-px bg-white/10"></div>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-white/10 hover:bg-white/20 py-2 rounded mb-2"
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
