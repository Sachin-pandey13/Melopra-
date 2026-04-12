import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import LoginModal from "../../components/LoginModal";
import useFirestoreProfileImage from "../../hooks/useFirestoreProfileImage";
import usePWAInstall from "../../hooks/usePWAInstall";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getAuth, updateProfile } from "firebase/auth";

export default function MobileTopBar({
  title,
  back,
  search,
  query,
  onQueryChange,
  placeholder = "Search songs, artists...",
}) {
  const { currentUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { isInstallable, promptInstall } = usePWAInstall();

  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const profileFromFirestore = useFirestoreProfileImage(currentUser?.uid);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showUserMenu]);

  const updateProfileImage = async (file) => {
    if (!file || !currentUser?.uid) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Melopra");
      formData.append("folder", "melopra-profiles");

      const res = await fetch(`https://api.cloudinary.com/v1_1/dkmmoprxk/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");

      const db = getFirestore();
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { profileImage: data.secure_url });

      const auth = getAuth();
      await updateProfile(auth.currentUser, { photoURL: data.secure_url });
      
      // Force reload to reflect across app, or just let the hook handle it
      setShowUserMenu(false);
    } catch (err) {
      console.error("Cloudinary upload failed:", err.message);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        {back && (
          <button className="text-lg" style={{ opacity: 0.9 }}>
            ←
          </button>
        )}

        {/* 🔍 SEARCH MODE */}
        {search ? (
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "white",
              outline: "none",
              fontSize: 14,
            }}
          />
        ) : (
          /* 🏷 TITLE MODE */
          <h1 className="text-lg font-semibold flex-1" style={{ opacity: 0.95 }}>
            {title}
          </h1>
        )}

        {/* 👤 AUTH BUTTON */}
        {currentUser ? (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                border: "2px solid rgba(255,255,255,0.2)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              {(currentUser.photoURL || profileFromFirestore) ? (
                <img
                  src={
                    (profileFromFirestore || currentUser.photoURL)?.includes("cloudinary")
                      ? (profileFromFirestore || currentUser.photoURL).replace(
                          "/upload/",
                          "/upload/q_auto:best,f_auto,w_200,h_200,c_fill,g_face/"
                        )
                      : (profileFromFirestore || currentUser.photoURL)
                  }
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                currentUser.email?.[0]?.toUpperCase() || "U"
              )}
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: "absolute",
                  top: 42,
                  right: 0,
                  background: "rgba(28,28,28,0.98)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "8px 0",
                  minWidth: 160,
                  zIndex: 100,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  style={{
                    padding: "10px 16px",
                    fontSize: 12,
                    opacity: 0.5,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 4,
                  }}
                >
                  {currentUser.email}
                </div>
                
                <label
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 16px",
                    color: "white",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) updateProfileImage(file);
                    }}
                  />
                  {uploading ? "Uploading..." : "Upload Profile Picture"}
                </label>
                <button
                  onPointerDown={(e) => {
                    // Fire immediately upon touch/click down
                    e.stopPropagation();
                    setShowUserMenu(false);
                    logout();
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    color: "#ff4d4d",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              border: "none",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Log In
          </button>
        )}
      </div>

      {/* Global PWA Install Banner/Button (only shows if installation is pending) */}
      {isInstallable && (
        <div
          style={{
            width: "100%",
            background: "rgba(29, 185, 84, 0.15)",
            borderBottom: "1px solid rgba(29, 185, 84, 0.3)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/icon-192.png" alt="Melopra" style={{ width: 24, height: 24, borderRadius: 6 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1DB954" }}>Get the Melopra App</span>
          </div>
          <button
            onClick={promptInstall}
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              background: "#1DB954",
              border: "none",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Install
          </button>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
