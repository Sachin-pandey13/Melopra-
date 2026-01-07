import React, { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const LANGUAGES = [
  { name: "English", region: "US" },
  { name: "Hindi", region: "IN" },
  { name: "Punjabi", region: "IN" },
  { name: "Tamil", region: "IN" },
  { name: "Telugu", region: "IN" },
  { name: "Korean", region: "KR" },
  { name: "Spanish", region: "ES" },
  { name: "French", region: "FR" },
  { name: "Japanese", region: "JP" },
  { name: "Arabic", region: "SA" },
];

const OnboardingPage = ({ user, onComplete }) => {
  const [artists, setArtists] = useState([]);
  const [filteredArtists, setFilteredArtists] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRegion, setCurrentRegion] = useState("US");

  // 🎧 Fetch Spotify artists (region-based or search, debounced)
  useEffect(() => {
    const controller = new AbortController();
    const fetchArtists = async () => {
      setLoading(true);
      try {
        const endpoint =
          searchTerm.trim().length > 0
            ? `https://deezer-proxy.sachinkumara1me.workers.dev/?artist=${encodeURIComponent(
                searchTerm
              )}&region=${currentRegion}`
            : `https://deezer-proxy.sachinkumara1me.workers.dev/?region=${currentRegion}`;

        const res = await fetch(endpoint, { signal: controller.signal });
        const data = await res.json();

        const artistList =
          data.artists?.map((a) => ({
            id: a.id,
            name: a.name,
            image:
              a.image ||
              "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
          })) ||
          data.songs?.map((s, i) => ({
            id: i,
            name: s.artist || s.title,
            image:
              s.image ||
              "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
          })) ||
          [];

        setArtists(artistList);
        setFilteredArtists(artistList);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch artists:", err);
          setArtists([]);
          setFilteredArtists([]);
        }
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(fetchArtists, 1000); // ⏳ 1000 ms debounce delay
    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [currentRegion, searchTerm]);

  // 🌍 Handle language selection
  const toggleLanguage = (lang) => {
    setSelectedLanguages((prev) => {
      const exists = prev.find((l) => l.name === lang.name);
      if (exists) return prev.filter((l) => l.name !== lang.name);
      return [...prev, lang];
    });
    setCurrentRegion(lang.region || "US");
  };

  // 🎤 Select or deselect artist
  const toggleArtist = (artistName) => {
    setSelectedArtists((prev) =>
      prev.includes(artistName)
        ? prev.filter((a) => a !== artistName)
        : [...prev, artistName]
    );
  };

  // 💾 Save preferences
  const handleSave = async () => {
    if (!user || !user.uid) {
      alert("User not signed in yet. Please try again.");
      return;
    }
    if (selectedArtists.length === 0 || selectedLanguages.length === 0) {
      alert("Please select at least one artist and one language.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          favoriteArtists: selectedArtists,
          selectedLanguages: selectedLanguages.map((l) => l.name),
        },
        { merge: true }
      );
      onComplete();
    } catch (err) {
      alert("Failed to save preferences. Check Firestore permissions.");
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // 🌀 Loading Screen
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white text-xl bg-black">
        Fetching your favorite artists...
      </div>
    );
  }

  // 🎨 UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col items-center overflow-y-auto">
      <div className="max-w-6xl w-full px-6 py-10 space-y-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold mb-2 flex justify-center items-center gap-2">
            Welcome to Melopra 🎵
          </h1>
          <p className="text-gray-400 text-lg">
            Let’s tune your experience — choose your languages and favorite artists.
          </p>
        </div>

        {/* Step 1 - Language Selection */}
        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Select Your Languages</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.name}
                onClick={() => toggleLanguage(lang)}
                className={`px-5 py-2 rounded-full border transition-all ${
                  selectedLanguages.some((l) => l.name === lang.name)
                    ? "bg-purple-600 border-purple-500"
                    : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 - Artist Search + Selection */}
        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Pick Your Favorite Artists ({currentRegion})
          </h2>

          {/* 🔍 Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search artists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 w-80 rounded-full bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Artist Grid */}
          <div className="max-h-[60vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2">
            {filteredArtists.length > 0 ? (
              filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => toggleArtist(artist.name)}
                  className={`cursor-pointer rounded-2xl overflow-hidden relative border-2 transition-all ${
                    selectedArtists.includes(artist.name)
                      ? "border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.8)]"
                      : "border-transparent hover:border-gray-600"
                  }`}
                >
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-end p-2 text-sm font-semibold">
                    {artist.name}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 col-span-full">
                No artists found for this language or search.
              </p>
            )}
          </div>
        </section>

        {/* Continue Button */}
        <div className="sticky bottom-4 text-center bg-black/40 backdrop-blur-lg py-4 rounded-lg">
          <button
            onClick={handleSave}
            disabled={
              saving ||
              selectedArtists.length === 0 ||
              selectedLanguages.length === 0
            }
            className="bg-purple-700 hover:bg-purple-600 px-8 py-3 rounded-full font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
