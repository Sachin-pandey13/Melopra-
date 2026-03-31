import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaMicrophone, FaSpinner } from "react-icons/fa";
import {
  useNowPlaying,
  playNext,
  playPrevious,
  togglePlay,
  enqueue,
  playItem,
} from "../state/useNowPlaying";
import { searchYouTube } from "../utils/searchYouTube";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ─── NLP Helpers ──────────────────────────────────────────────────────────────

/** Words to strip from transcript before extracting song name */
const FILLER_WORDS = new Set([
  "hey", "melo", "please", "can", "you", "um", "uh", "like",
  "me", "the", "a", "an",
]);

/** Detect intent from normalised transcript text */
function detectIntent(text) {
  // ── DETECT ──
  if (
    /what(?:'s| is)(?: this| the)? song/i.test(text) ||
    /detect(?: this| the)? song/i.test(text) ||
    /identify(?: this| the)? song/i.test(text) ||
    /name(?: this| the)? song/i.test(text) ||
    /shazam/i.test(text) ||
    /what(?:'s| is) playing/i.test(text)
  ) {
    return { intent: "detect" };
  }

  // ── NEXT ──
  if (/\b(next|skip|skip this)\b/i.test(text) && !/add|queue|play\s+\w+/i.test(text)) {
    return { intent: "next" };
  }

  // ── PREVIOUS ──
  if (/\b(previous|go back|last song|back)\b/i.test(text) && !/add|queue/i.test(text)) {
    return { intent: "previous" };
  }

  // ── PAUSE ──
  if (/\b(pause|stop(?: music| playing)?)\b/i.test(text) && !/add|queue/i.test(text)) {
    return { intent: "pause" };
  }

  // ── RESUME ──
  if (/\b(resume|continue|unpause)\b/i.test(text) && !/add|queue/i.test(text)) {
    return { intent: "resume" };
  }

  // ── QUEUE ─ priority over PLAY when "queue" keyword present ──
  const queueMatch = text.match(
    /(?:add|put|queue(?:\s+up)?|enqueue)\s+(.+?)(?:\s+(?:to|in|into|on)\s+(?:the\s+)?(?:queue|list|playlist))?$/i
  );
  if (
    queueMatch ||
    /\b(?:to|in(?:to)?)\s+(?:the\s+)?(?:queue|list)\b/i.test(text)
  ) {
    const rawQuery = queueMatch ? queueMatch[1] : text;
    const song = extractSongName(rawQuery, ["add", "put", "queue", "up", "enqueue", "to", "in", "into", "the", "list", "playlist"]);
    return song ? { intent: "queue", song } : null;
  }

  // ── PLAY ──
  const playMatch = text.match(/^play\s+(.+)/i);
  if (playMatch) {
    const rest = playMatch[1].trim();
    if (/^next\b/i.test(rest)) return { intent: "next" };
    if (/^(?:previous|back|last song)\b/i.test(rest)) return { intent: "previous" };
    const song = extractSongName(rest, []);
    return song ? { intent: "play", song } : { intent: "resume" };
  }

  // ── FALLBACK ─ treat entire text as a play search ──
  const song = extractSongName(text, ["play", "add", "queue"]);
  if (song && song.split(" ").length >= 2) {
    return { intent: "play", song };
  }

  return { intent: "unknown", text };
}

/** Strip stopwords and return a clean search query */
function extractSongName(raw, extraStops = []) {
  const stops = new Set([...FILLER_WORDS, ...extraStops.map((w) => w.toLowerCase())]);
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stops.has(w))
    .join(" ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const { isPlaying } = useNowPlaying();

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptRef = useRef("");
  const processingRef = useRef(false); // debounce flag

  const showFeedback = useCallback((msg, autoClear = 5000) => {
    setFeedbackText(msg);
    if (autoClear) setTimeout(() => setFeedbackText(""), autoClear);
  }, []);

  // ── Initialise Web Speech API ──────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let str = "";
      for (let i = 0; i < event.results.length; i++) {
        str += event.results[i][0].transcript;
      }
      transcriptRef.current = str;
      setFeedbackText(`"${str}..."`);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => rec.stop(), 1800);
    };

    rec.onerror = (event) => {
      setIsListening(false);
      if (event.error === "network") showFeedback("Browser STT failed (use Chrome).");
      else if (event.error === "not-allowed") showFeedback("Microphone access denied.");
      else showFeedback("Could not hear you. Try again.");
    };

    rec.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const captured = transcriptRef.current.trim();
      if (captured) {
        handleCommand(captured);
        transcriptRef.current = "";
      } else {
        setFeedbackText("");
      }
    };

    recognitionRef.current = rec;
  }, []);

  // ── Command Handler ────────────────────────────────────────────────────────
  const handleCommand = async (transcript) => {
    if (processingRef.current) return; // debounce
    processingRef.current = true;
    setIsProcessing(true);

    const result = detectIntent(transcript.toLowerCase().trim());
    console.log("[Melo Intent]", result);

    try {
      switch (result?.intent) {
        case "detect":
          await handleAudioDetection();
          break;

        case "queue": {
          showFeedback(`Adding "${result.song}" to queue...`, 0);
          const hits = await searchYouTube(result.song);
          if (hits.length) {
            enqueue(hits[0]);
            showFeedback(`✅ Added: ${hits[0].title}`);
          } else {
            showFeedback(`Couldn't find "${result.song}"`);
          }
          break;
        }

        case "play": {
          showFeedback(`Searching "${result.song}"...`, 0);
          const hits = await searchYouTube(result.song);
          if (hits.length) {
            playItem(hits[0]);
            showFeedback(`▶ Playing: ${hits[0].title}`);
          } else {
            showFeedback(`Couldn't find "${result.song}"`);
          }
          break;
        }

        case "next":
          playNext();
          showFeedback("⏭ Skipped.");
          break;

        case "previous":
          playPrevious();
          showFeedback("⏮ Going back...");
          break;

        case "pause":
          togglePlay();
          showFeedback("⏸ Paused.");
          break;

        case "resume":
          togglePlay();
          showFeedback("▶ Resumed.");
          break;

        default:
          showFeedback("I didn't quite catch that. Try again.");
      }
    } catch (err) {
      console.error("[Melo Error]", err);
      showFeedback("Something went wrong. Please try again.");
    }

    setIsProcessing(false);
    processingRef.current = false;
  };

  // ── Audio Detection ────────────────────────────────────────────────────────
  const handleAudioDetection = async () => {
    showFeedback("🎵 Hold phone near music (10s)...", 0);

    // ⏳ Small delay so SpeechRecognition fully releases the mic before we grab it
    await new Promise((r) => setTimeout(r, 600));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // ✅ CRITICAL: Disable all voice-call processing — these destroy music quality
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 44100,
        },
      });

      // Pick the best supported format
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
        MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" :
        "audio/ogg";

      const rec = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,  // higher quality capture
      });
      const chunks = [];

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        showFeedback("🔍 Identifying song...", 0);

        const form = new FormData();
        form.append("demo", blob, `recording.${mimeType.includes("ogg") ? "ogg" : "webm"}`);

        try {
          const res = await fetch(`${API_BASE}/api/detect`, {
            method: "POST",
            body: form,
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

          if (data.matches && data.matches.length > 0) {
            const best = data.matches[0];
            const query = `${best.title} ${best.artist || ""}`.trim();
            showFeedback(`🎵 Found: ${best.title}`, 0);
            const yt = await searchYouTube(query);
            if (yt.length) {
              playItem(yt[0]);
              showFeedback(`▶ Playing: ${yt[0].title}`);
            } else {
              showFeedback(`Found "${best.title}" but couldn't stream it.`);
            }
          } else {
            showFeedback("Couldn't identify the song. Try a longer clip.");
          }
        } catch (e) {
          console.error("[Detect Error]", e);
          showFeedback(`Detection failed: ${e.message}`);
        }
      };

      rec.start();
      // Record for 10 seconds (was 5) — better accuracy
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 10000);
    } catch (err) {
      console.error(err);
      showFeedback("Microphone access denied.");
    }
  };

  // ── Toggle Listen ──────────────────────────────────────────────────────────
  const toggleListen = () => {
    if (!recognitionRef.current) {
      showFeedback("Voice recognition not supported (use Chrome).");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      transcriptRef.current = "";
      showFeedback("🎙 Listening...", 0);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 110,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        {feedbackText && (
          <div
            style={{
              background: "rgba(0,0,0,0.88)",
              color: "white",
              padding: "10px 16px",
              borderRadius: 20,
              fontSize: 13,
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              maxWidth: 240,
              textAlign: "center",
              animation: "meloFadeIn 0.25s ease",
              lineHeight: 1.4,
            }}
          >
            {feedbackText}
          </div>
        )}

        <button
          onClick={toggleListen}
          aria-label={isListening ? "Stop listening" : "Start voice assistant"}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            border: "none",
            background: isListening
              ? "#ff4081"
              : "linear-gradient(135deg, #FF007F, #ff4081)",
            color: "white",
            fontSize: 22,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: isListening
              ? "0 0 20px #ff4081"
              : "0 4px 12px rgba(0,0,0,0.3)",
            cursor: "pointer",
            transition: "all 0.3s ease",
            animation:
              isListening || isProcessing
                ? "meloPulse 1.5s infinite"
                : "none",
          }}
        >
          {isProcessing ? (
            <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <FaMicrophone />
          )}
        </button>
      </div>

      <style>{`
        @keyframes meloFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes meloPulse {
          0%   { transform: scale(1);   box-shadow: 0 0 0 0   rgba(255,64,129,0.7); }
          70%  { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(255,64,129,0); }
          100% { transform: scale(1);   box-shadow: 0 0 0 0   rgba(255,64,129,0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
