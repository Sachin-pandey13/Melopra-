import React, { useEffect, useState, useCallback, useRef } from "react";
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
const API =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://melopra-backend.onrender.com");

// ── Popular artist names per language (used when no search query) ──────────
const LANG_DEFAULT_ARTISTS = {
  english: ["Taylor Swift", "Ed Sheeran", "The Weeknd", "Drake", "Billie Eilish", "Bruno Mars"],
  hindi:   ["Arijit Singh", "Jubin Nautiyal", "Shreya Ghoshal", "Neha Kakkar", "Atif Aslam", "Badshah"],
  punjabi: ["Karan Aujla", "Diljit Dosanjh", "AP Dhillon", "Shubh", "Ammy Virk", "Sidhu Moosewala"],
  tamil:   ["Anirudh Ravichander", "AR Rahman", "Sid Sriram", "D Imman", "Yuvan Shankar Raja"],
  telugu:  ["Devi Sri Prasad", "SS Thaman", "Sid Sriram", "Manisharma"],
  korean:  ["BTS", "Blackpink", "EXO", "Twice", "Stray Kids", "Seventeen"],
  spanish: ["Bad Bunny", "J Balvin", "Ozuna", "Maluma", "Karol G", "Shakira"],
  french:  ["Stromae", "Aya Nakamura", "Angele", "Maitre Gims", "Nekfeu"],
  japanese:["YOASOBI", "Kenshi Yonezu", "ONE OK ROCK", "Official HIGE DANdism"],
  arabic:  ["Amr Diab", "Nancy Ajram", "Elissa", "Ragheb Alama"],
};

// ── Tiny sessionStorage cache ──────────────────────────────────────────────
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function readCache(key) {
  try {
    const item = JSON.parse(sessionStorage.getItem(key));
    if (item && Date.now() - item.ts < CACHE_TTL) return item.data;
  } catch {}
  return null;
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ── Skeleton card ──────────────────────────────────────────────────────────
function ArtistSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border-2 border-transparent animate-pulse">
      <div className="w-full h-48 bg-gray-700/60" />
      <div className="bg-black/50 p-2">
        <div className="h-3 w-3/4 bg-gray-600 rounded" />
      </div>
    </div>
  );
}

const OnboardingPage = ({ user, onComplete }) => {
  const [artists, setArtists] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]); // Array of language objects
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRegion, setCurrentRegion] = useState("US");
  const [isTyping, setIsTyping] = useState(false); // true while user is still typing

  const abortRef = useRef(null);

  // ── Fetch artists via JioSaavn (/api/artist-search) ──────────────────────
  const fetchArtists = useCallback(async (langs, query) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // ensure langs is an array
    const langArray = Array.isArray(langs) ? langs : [langs];
    if (langArray.length === 0) langArray.push("english");

    const cacheKey = `melopra_ob_artists__${langArray.join(",")}__${query}`;
    const cached = readCache(cacheKey);
    if (cached) {
      setArtists(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let results = [];

      if (query.trim().length > 0) {
        // User searching
        const res = await fetch(`${API}/api/artist-search?artist=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await res.json();
        results = data.artists || [];
      } else {
        // No search -> fetch default popular artists for ALL selected languages
        const allNames = [];
        langArray.forEach(lang => {
          const names = LANG_DEFAULT_ARTISTS[lang] || LANG_DEFAULT_ARTISTS.english;
          allNames.push(...names.slice(0, 6)); // Take top 6 from each to avoid too many requests
        });

        const promises = [...new Set(allNames)].map(name =>
          fetch(`${API}/api/artist-search?artist=${encodeURIComponent(name)}`, { signal: controller.signal })
            .then(r => r.json())
            .then(d => (d.artists || []).slice(0, 1)) // Take top match for each name
            .catch(() => [])
        );

        const arrays = await Promise.all(promises);
        const seen = new Set();
        results = arrays.flat().filter((a) => {
          if (!a.name || seen.has(a.name.toLowerCase())) return false;
          seen.add(a.name.toLowerCase());
          return true;
        });
      }

      writeCache(cacheKey, results);
      if (!controller.signal.aborted) setArtists(results);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Failed to fetch artists:", err);
        setArtists([]);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // ── Effect 1: Language change → load instantly (no search active) ───────
  useEffect(() => {
    if (searchTerm) return; 
    const langKeys = selectedLanguages.length > 0 
      ? selectedLanguages.map(l => l.name.toLowerCase()) 
      : ["english"];
    fetchArtists(langKeys, "");
  }, [selectedLanguages]); 

  // ── Effect 2: Search term → 1200ms debounce, min 2 chars ─────────────────
  useEffect(() => {
    if (!searchTerm) return; 
    const langKeys = selectedLanguages.length > 0 
      ? selectedLanguages.map(l => l.name.toLowerCase()) 
      : ["english"];

    // Too short — clear results and stop
    if (searchTerm.trim().length < 2) {
      setIsTyping(false);
      setArtists([]);
      return;
    }

    // Check cache immediately — no delay if we already have the result
    const cacheKey = `melopra_ob_artists__${langKeys.join(",")}__${searchTerm.trim()}`;
    const cached = readCache(cacheKey);
    if (cached) {
      setIsTyping(false);
      setArtists(cached);
      return;
    }

    // Debounce: wait 1200ms after last keystroke before firing API
    const timer = setTimeout(() => {
      setIsTyping(false);
      fetchArtists(langKeys, searchTerm);
    }, 1200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    // Show typing indicator only when there's enough text to warrant a search
    if (val.trim().length >= 2) setIsTyping(true);
    else setIsTyping(false);
  };

  const toggleLanguage = (lang) => {
    setSelectedLanguages((prev) => {
      if (prev.some(l => l.name === lang.name)) {
        return prev.filter(l => l.name !== lang.name);
      } else {
        return [...prev, lang];
      }
    });
    setSearchTerm("");
    setIsTyping(false);
    setCurrentRegion(lang.region || "US");
  };

  const toggleArtist = (artistName) => {
    setSelectedArtists((prev) =>
      prev.includes(artistName) ? prev.filter((a) => a !== artistName) : [...prev, artistName]
    );
  };

  const handleSave = async () => {
    if (!user?.uid) { alert("User not signed in yet."); return; }
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col items-center overflow-y-auto">
      <div className="max-w-6xl w-full px-6 py-10 space-y-10">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold mb-2">Welcome to Melopra 🎵</h1>
          <p className="text-gray-400 text-lg">Choose your languages and favorite artists.</p>
        </div>

        {/* Language Pills */}
        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Select Your Languages</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.name}
                onClick={() => toggleLanguage(lang)}
                className={`px-5 py-2 rounded-full border transition-all ${
                  selectedLanguages.some((l) => l.name === lang.name)
                    ? "bg-purple-600 border-purple-500 shadow-lg shadow-purple-900/40"
                    : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </section>

        {/* Artist Picker */}
        <section className="text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Pick Your Favorite Artists
            {currentRegion && (
              <span className="ml-2 text-sm font-normal text-gray-400">({currentRegion})</span>
            )}
          </h2>

          {/* ── Professional Search Box ── */}
          <div className="relative w-80 mx-auto mb-6">
            {/* Search icon */}
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none select-none">
              🔍
            </span>

            <input
              type="text"
              placeholder="Search artists... (min 2 chars)"
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2.5 rounded-full bg-gray-800 text-white outline-none focus:ring-2 focus:ring-purple-600 transition-all placeholder-gray-500"
            />

            {/* Right side: clear ✕ OR animated typing dots */}
            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isTyping ? (
                /* 3-dot typing animation */
                <span className="flex gap-1 items-center" title="Waiting for you to finish typing…">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      style={{
                        display: "inline-block",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#a855f7",
                        animation: `typingBounce 0.9s ${delay}ms ease-in-out infinite`,
                      }}
                    />
                  ))}
                  <style>{`
                    @keyframes typingBounce {
                      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                      40%           { transform: translateY(-5px); opacity: 1; }
                    }
                  `}</style>
                </span>
              ) : searchTerm ? (
                <button
                  onClick={() => { setSearchTerm(""); setIsTyping(false); setArtists([]); }}
                  className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
                  title="Clear search"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>

          {/* Hint under the box */}
          {searchTerm.length > 0 && searchTerm.trim().length < 2 && (
            <p className="text-xs text-gray-500 mb-4">Type at least 2 characters to search…</p>
          )}
          {isTyping && (
            <p className="text-xs text-purple-400 mb-4 animate-pulse">Searching in 1.2 s…</p>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {(loading || isTyping) ? (
              Array.from({ length: 10 }).map((_, i) => <ArtistSkeleton key={i} />)

            ) : artists.length > 0 ? (
              artists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => toggleArtist(artist.name)}
                  className={`cursor-pointer rounded-2xl overflow-hidden border-2 transition-all ${
                    selectedArtists.includes(artist.name)
                      ? "border-purple-500 scale-105"
                      : "border-transparent hover:border-gray-600"
                  }`}
                >
                  <img
                    src={artist.image || "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"}
                    alt={artist.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
                    }}
                  />
                  <div className="bg-black/60 p-2 text-sm truncate">{artist.name}</div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 col-span-full py-8">
                {selectedLanguages.length === 0
                  ? "👆 Select a language above to see artists"
                  : "No artists found. Try a different search."}
              </p>
            )}
          </div>
        </section>

        {/* Selected count badge */}
        {selectedArtists.length > 0 && (
          <div className="text-center text-purple-300 text-sm">
            ✓ {selectedArtists.length} artist{selectedArtists.length > 1 ? "s" : ""} selected
          </div>
        )}

        {/* CTA */}
        <div className="text-center pb-10">
          <button
            onClick={handleSave}
            disabled={saving || selectedArtists.length === 0 || selectedLanguages.length === 0}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed px-8 py-3 rounded-full font-semibold transition-all"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingPage;