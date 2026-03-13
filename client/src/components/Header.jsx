import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import useFirestoreProfileImage from "../hooks/useFirestoreProfileImage";
import { getAuth, updateProfile } from "firebase/auth";
import DetectMusic from "./DetectMusic";

// 🧠 Melo Integration
import MeloButton from "./melo/MeloButton";
import MeloOrb from "./melo/MeloOrb";

const Header = ({
  searchTerm,
  setSearchTerm,
  onLoginClick,
  onSongPlay,
  onPause,
  onResume,
  onNext,
  onPrev,
  onQueueUpdate,
  onLike
}) => {
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetectMusicModal, setShowDetectMusicModal] = useState(false);
  const [meloPersona, setMeloPersona] = useState(
    localStorage.getItem("meloPersona") || "female"
  );
  const [meloAvatar, setMeloAvatar] = useState(
    localStorage.getItem("meloAvatar") || ""
  );

  const profileFromFirestore = useFirestoreProfileImage(currentUser?.uid);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  const updateProfileImage = async (file) => {
    if (!file || !currentUser?.uid) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Melopra");
      formData.append("folder", "melopra-profiles");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/dkmmoprxk/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");

      const db = getFirestore();
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { profileImage: data.secure_url });

      const auth = getAuth();
      await updateProfile(auth.currentUser, { photoURL: data.secure_url });
      window.location.reload();
    } catch (err) {
      console.error("Cloudinary upload failed:", err.message);
    }
  };

  const handleMeloAvatarUpload = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Melopra");
      formData.append("folder", "melopra-avatars");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/dkmmoprxk/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      if (data.secure_url) {
        setMeloAvatar(data.secure_url);
        localStorage.setItem("meloAvatar", data.secure_url);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err.message);
    }
  };

  return (
    <header className="w-full px-6 py-4 flex items-center justify-between bg-black z-10 shadow-lg border-b border-white/10">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <span className="text-2xl cursor-pointer animate-bounce">🎵</span>
        <h1 className="text-xl font-bold text-white">Melopra</h1>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md px-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search songs, artists..."
          className="w-full px-4 py-2 bg-white/10 text-white placeholder-gray-400 rounded-full outline-none focus:ring-2 focus:ring-purple-500 transition hover:bg-white/20"
        />
      </div>

      {/* Right: Profile + Melo */}
      <div className="relative flex items-center gap-4">
        {/* 🧠 Melo Icon */}
        <MeloButton
          onSongPlay={onSongPlay}
          onPause={onPause}
          onResume={onResume}
          onNext={onNext}
          onPrev={onPrev}
          onQueueUpdate={onQueueUpdate}
          onLike={onLike}
        />
        <MeloOrb />

        {currentUser ? (
          <div
            className="relative group"
            onMouseEnter={() => setShowDropdown(true)}
            onMouseLeave={() => setShowDropdown(false)}
          >
            <motion.div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-center flex items-center justify-center cursor-pointer shadow-lg overflow-hidden"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {(currentUser.photoURL || profileFromFirestore) ? (
                <img
                  src={
                    currentUser.photoURL?.includes("cloudinary")
                      ? currentUser.photoURL.replace(
                          "/upload/",
                          "/upload/q_auto:best,f_auto,w_200,h_200,c_fill,g_face/"
                        )
                      : currentUser.photoURL
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser.email?.charAt(0).toUpperCase()}</span>
              )}
            </motion.div>

            {/* Dropdown */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  className="absolute right-0 mt-2 bg-black border border-white/10 rounded-md shadow-lg w-48 z-50 p-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="w-full text-left px-3 py-2 text-white hover:bg-white/10 rounded"
                  >
                    Upload Profile Picture
                  </button>

                  <button
                    onClick={() => setShowDetectMusicModal(true)}
                    className="w-full text-left px-3 py-2 text-white hover:bg-white/10 rounded"
                  >
                    Detect Music
                  </button>

                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full text-left px-3 py-2 text-white hover:bg-white/10 rounded"
                  >
                    Settings
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500 hover:text-white rounded"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium transition"
          >
            + Add Profile
          </button>
        )}
      </div>

      {/* Upload Profile Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg text-black">
            <h2 className="text-lg font-bold mb-4">Upload Profile Picture</h2>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  updateProfileImage(file);
                  setShowUploadModal(false);
                }
              }}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detect Music Modal */}
      {showDetectMusicModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-[#111] text-white p-6 rounded-2xl shadow-xl w-[500px] relative border border-white/10">
            <button
              onClick={() => setShowDetectMusicModal(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4 text-center">Detect Music</h2>
            <DetectMusic />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white p-6 rounded-lg w-[420px] shadow-lg text-black">
            <h2 className="text-lg font-bold mb-4">Melo Settings</h2>

            <div className="flex flex-col gap-4">
              {/* Persona */}
              <div>
                <label className="block font-semibold mb-1">
                  Choose Melo Persona:
                </label>
                <select
                  value={meloPersona}
                  onChange={(e) => {
                    setMeloPersona(e.target.value);
                    localStorage.setItem("meloPersona", e.target.value);
                  }}
                  className="border p-2 rounded w-full"
                >
                  <option value="female">🎵 Female</option>
                  <option value="male">🎧 Male</option>
                </select>
              </div>

              {/* Avatar */}
              <div>
                <label className="block font-semibold mb-1">
                  Upload Melo Avatar:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleMeloAvatarUpload(file);
                  }}
                />
                {meloAvatar && (
                  <img
                    src={meloAvatar}
                    alt="Melo Avatar"
                    className="w-16 h-16 rounded-full mt-2"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
