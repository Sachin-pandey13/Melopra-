import { useState, useCallback } from "react";

const CACHE = new Map();

export default function useYouTubeAPI(apiKey) {
  const [error, setError] = useState(null);
  const fetchYT = useCallback(async (endpoint, params={}) => {
    const qs = new URLSearchParams({...params, key: apiKey});
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs.toString()}`;
    // simple cache key
    if (CACHE.has(url)) {
      return CACHE.get(url);
    }
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (res.status >= 400) {
        setError(json);
        throw new Error(json.error?.message || "YT API error");
      }
      CACHE.set(url, json);
      return json;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [apiKey]);

  return { fetchYT, error };
}
