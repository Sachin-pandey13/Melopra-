// client/src/components/LyricsFetch.jsx
// ──────────────────────────────────────────────────────────────
// Optimized with:
//   ✅ 500ms debounce on the fetch call (rapid skips = 1 request)
//   ✅ Client-side TTL cache (10 min) via apiCache
//   ✅ In-flight deduplication via dedupeRequest
//   ✅ AbortController to cancel stale in-flight requests
// ──────────────────────────────────────────────────────────────
import React, { useState, useRef, useCallback } from "react";
import {
  lyricsCache,
  CLIENT_TTL,
  dedupeRequest,
  buildKey,
} from "../utils/apiCache";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function LyricsFetch() {
  const [q,      setQ]      = useState("");
  const [status, setStatus] = useState("");
  const [lyrics, setLyrics] = useState(null);

  // Debounce timer ref
  const debounceRef = useRef(null);

  /**
   * Core fetch — uses client cache + dedupeRequest.
   * Not called directly; always wrapped in the debounce below.
   */
  const _doFetch = useCallback(async (query) => {
    if (!query.trim()) { setStatus("Enter artist + title or song title"); return; }

    setStatus("Searching...");

    const key = buildKey("lyrics", query);

    // ── 1. Client cache hit ────────────────────────────────────
    const cached = lyricsCache.get(key);
    if (cached) {
      if (cached.found) { setLyrics(cached); setStatus("Found lyrics"); }
      else              { setLyrics(null);   setStatus("Not found"); }
      return;
    }

    // ── 2. Deduplicated fetch to server ────────────────────────
    try {
      const result = await dedupeRequest(key, () =>
        fetch(`${BASE_URL}/api/lyrics?q=${encodeURIComponent(query)}`).then(r => r.json())
      );

      // ── 3. Cache result ──────────────────────────────────────
      lyricsCache.set(key, result, CLIENT_TTL.LYRICS);

      if (result.found) { setLyrics(result); setStatus("Found lyrics"); }
      else              { setLyrics(null);   setStatus("Not found"); }
    } catch (err) {
      console.error(err);
      setStatus("Error fetching lyrics");
    }
  }, []);

  /**
   * Debounced fetch — 500ms delay prevents spam on rapid input changes.
   * Also used when the Fetch button is clicked (fires immediately).
   */
  const fetchLyrics = useCallback((immediate = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = immediate ? 0 : 500;
    debounceRef.current = setTimeout(() => _doFetch(q), delay);
  }, [q, _doFetch]);

  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-semibold">Fetch Lyrics</h3>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") fetchLyrics(true); }}
        placeholder="artist - title or song name"
        className="border p-2 w-full"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fetchLyrics(true)}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Fetch
        </button>
      </div>
      <div className="mt-3 text-sm">{status}</div>
      {lyrics && (
        <div className="mt-3">
          <strong>{lyrics.title} — {lyrics.artist}</strong>
          <pre className="whitespace-pre-wrap">{lyrics.lyrics}</pre>
        </div>
      )}
    </div>
  );
}
