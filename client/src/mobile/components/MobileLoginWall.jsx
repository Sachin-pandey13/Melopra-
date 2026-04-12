import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

/**
 * MobileLoginWall
 * ─────────────────────────────────────────────
 * A premium bottom-sheet that gates song playback
 * until the user is authenticated. Supports:
 *   - Google Sign-In (one tap)
 *   - Email / Password login
 *   - Account creation (toggle)
 */
export default function MobileLoginWall({ onClose, onSuccess }) {
  const { login, signup, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      onSuccess?.();
    } catch (err) {
      const msg = err?.code || err?.message || "Auth failed";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential"))
        setError("Wrong email or password.");
      else if (msg.includes("user-not-found"))
        setError("No account found. Try signing up.");
      else if (msg.includes("email-already-in-use"))
        setError("Email already in use. Try logging in.");
      else if (msg.includes("weak-password"))
        setError("Password must be at least 6 characters.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      onSuccess?.();
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(170deg, #141414 0%, #0d0d0d 100%)",
          borderRadius: "24px 24px 0 0",
          padding: "28px 24px 48px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          animation: "slideUp 0.32s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Drag Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.2)",
          margin: "0 auto 24px",
        }} />

        {/* Lock Icon + Headline */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #1DB954 0%, #14833b 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 14px",
            boxShadow: "0 8px 24px rgba(29,185,84,0.35)",
          }}>🎵</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
            {mode === "login" ? "Sign in to play" : "Create your account"}
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
            {mode === "login"
              ? "Your music. Your data. Your recommendations."
              : "Join Melopra for a personalized experience."}
          </p>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            marginBottom: 16,
            transition: "background 0.2s",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.8-1.9 13.4-5.1l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8L6 33.1C9.3 39.7 16.1 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6l6.2 5.2C41.9 35.2 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            style={inputStyle}
          />

          {error && (
            <div style={{
              fontSize: 12, color: "#ff5f5f",
              background: "rgba(255,80,80,0.1)",
              borderRadius: 8, padding: "8px 12px",
              border: "1px solid rgba(255,80,80,0.2)",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "13px 16px",
              borderRadius: 14,
              border: "none",
              background: loading
                ? "rgba(29,185,84,0.4)"
                : "linear-gradient(135deg, #1DB954 0%, #14833b 100%)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              transition: "opacity 0.2s",
              opacity: loading ? 0.7 : 1,
              boxShadow: loading ? "none" : "0 6px 20px rgba(29,185,84,0.3)",
            }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Toggle Mode */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={{
              background: "none", border: "none",
              color: "#1DB954", fontWeight: 600,
              cursor: "pointer", fontSize: 13,
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
