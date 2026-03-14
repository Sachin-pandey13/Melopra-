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

// Backend URL
const API = "https://melopra-backend.onrender.com";

const OnboardingPage = ({ user, onComplete }) => {
  const [artists, setArtists] = useState([]);
  const [filteredArtists, setFilteredArtists] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRegion, setCurrentRegion] = useState("US");

  useEffect(() => {
    const controller = new AbortController();

    const fetchArtists = async () => {
      setLoading(true);

      try {
        const endpoint =
  searchTerm.trim().length > 0
    ? `${API}/api/deezer-artist?artist=${encodeURIComponent(searchTerm)}`
    : `${API}/api/deezer-artist?lang=${(selectedLanguages[0]?.name || "english").toLowerCase()}`;

const res = await fetch(endpoint, { signal: controller.signal });
const data = await res.json();
        const artistList = data.artists || [];

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

    const delay = setTimeout(fetchArtists, 600);

    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [searchTerm, selectedLanguages]);

  const toggleLanguage = (lang) => {
  setSelectedLanguages([lang]); // only one language active

  setSearchTerm(""); // reset search

  setCurrentRegion(lang.region || "US");
};

  const toggleArtist = (artistName) => {
    setSelectedArtists((prev) =>
      prev.includes(artistName)
        ? prev.filter((a) => a !== artistName)
        : [...prev, artistName]
    );
  };

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
      console.error("Save error:", err);
      alert("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white text-xl bg-black">
        Fetching your favorite artists...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col items-center overflow-y-auto">
      <div className="max-w-6xl w-full px-6 py-10 space-y-10">

        <div className="text-center">
          <h1 className="text-4xl font-extrabold mb-2">
            Welcome to Melopra 🎵
          </h1>
          <p className="text-gray-400 text-lg">
            Choose your languages and favorite artists.
          </p>
        </div>

        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Select Your Languages</h2>

          <div className="flex flex-wrap gap-3 justify-center">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.name}
                onClick={() => toggleLanguage(lang)}
                className={`px-5 py-2 rounded-full border ${
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

        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Pick Your Favorite Artists ({currentRegion})
          </h2>

          <input
            type="text"
            placeholder="Search artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 w-80 rounded-full bg-gray-800 text-white mb-6"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredArtists.length > 0 ? (
              filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => toggleArtist(artist.name)}
                  className={`cursor-pointer rounded-2xl overflow-hidden border-2 ${
                    selectedArtists.includes(artist.name)
                      ? "border-purple-500"
                      : "border-transparent hover:border-gray-600"
                  }`}
                >
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-full h-48 object-cover"
                  />

                  <div className="bg-black/50 p-2 text-sm">
                    {artist.name}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 col-span-full">
                No artists found.
              </p>
            )}
          </div>
        </section>

        <div className="text-center">
          <button
            onClick={handleSave}
            disabled={
              saving ||
              selectedArtists.length === 0 ||
              selectedLanguages.length === 0
            }
            className="bg-purple-700 hover:bg-purple-600 px-8 py-3 rounded-full"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingPage;