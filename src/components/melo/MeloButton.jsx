import React, { useState, useEffect, useRef } from "react";

const MeloButton = ({
  onSongPlay,
  onPause,
  onResume,
  onNext,
  onPrev,
  onQueueUpdate,
  onLike,
}) => {
  const [state, setState] = useState("idle"); // idle | listening | thinking
  const [persona, setPersona] = useState(
    localStorage.getItem("meloPersona") || "female"
  );
  const [voices, setVoices] = useState([]);
  const [userAffinity, setUserAffinity] = useState(
    JSON.parse(localStorage.getItem("meloAffinity") || "{}")
  );

  const recognitionRef = useRef(null);

  // 🔒 HARD LOCKS (critical fixes)
  const commandLockRef = useRef(false);
  const lastTranscriptRef = useRef("");

  const MELO_API = "http://127.0.0.1:5001/api/melo";
  const LIKE_API = "http://127.0.0.1:5001/api/like";

  // === Load available voices ===
  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const v = synth.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }, []);

  // === Initialize speech recognition ===
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // single command per click

    recognition.onstart = () => {
      setState("listening");
    };

    recognition.onend = () => {
      // let UI breathe before reset
      setTimeout(() => {
        setState("idle");
        commandLockRef.current = false;
      }, 300);
    };

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      // 🧠 HARD BLOCK: duplicate / partial spam
      if (
        commandLockRef.current ||
        transcript === lastTranscriptRef.current
      ) {
        return;
      }

      commandLockRef.current = true;
      lastTranscriptRef.current = transcript;

      console.log("🎙️ User said:", transcript);
      setState("thinking");

      learnUserTone(transcript);

      try {
        const res = await fetch(MELO_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: transcript }),
        });

        if (!res.ok) throw new Error("Failed to reach Melo backend.");

        const data = await res.json();
        console.log("🤖 Melo:", data);

        if (data.reply) speak(data.reply);
        handleBackendResponse(data);
      } catch (err) {
        console.error("❌ Error contacting backend:", err);
        speak("I’m having trouble reaching the server right now.");
      }
    };

    recognitionRef.current = recognition;
  }, [voices]);

  // === Handle backend actions ===
  const handleBackendResponse = async (data) => {
    if (!data) return;

    const { song, queue, action } = data;
    console.log("🎛 Backend Action:", action);

    // 🧠 Queue-only actions → NO auto play
    if (action === "add_to_queue" || action === "play_next") {
      if (queue && Array.isArray(queue)) {
        onQueueUpdate?.(queue);
      }
      return;
    }

    switch (action) {
      case "pause":
        onPause?.();
        break;

      case "resume":
        onResume?.();
        break;

      case "next":
        onNext?.();
        break;

      case "previous":
        onPrev?.();
        break;

      case "like":
        if (song) {
          await addToLiked(song);
          onLike?.(song);
        }
        break;

      case "play_direct":
      default:
        // 🔒 ONLY play when backend really intends playback
        if (song) onSongPlay?.(song);
        break;
    }
  };

  // === Speech synthesis ===
  const speak = (text) => {
    if (!voices.length || !text) return;

    const synth = window.speechSynthesis;
    const voice =
      voices.find((v) =>
        persona === "male"
          ? v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("daniel") ||
            v.name.toLowerCase().includes("alex")
          : v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("karen") ||
            v.name.toLowerCase().includes("susan")
      ) || voices[0];

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.rate = 1;
    utter.pitch = persona === "male" ? 0.9 : 1.1;
    synth.speak(utter);
  };

  // === Add song to liked ===
  const addToLiked = async (song) => {
    try {
      const userId = localStorage.getItem("userId") || "guest";
      await fetch(LIKE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, song }),
      });
    } catch (e) {
      console.warn("Failed to like song:", e);
    }
  };

  // === Fine-tuning from user phrasing ===
  const learnUserTone = (sentence) => {
    const toneData = { ...userAffinity };
    const words = sentence
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    words.forEach((w) => {
      toneData[w] = (toneData[w] || 0) + 1;
    });

    setUserAffinity(toneData);
    localStorage.setItem("meloAffinity", JSON.stringify(toneData));
  };

  // === Button glow animation ===
  const getGlow = () => {
    switch (state) {
      case "listening":
        return "shadow-[0_0_25px_#7FFFD4] animate-pulse";
      case "thinking":
        return "shadow-[0_0_25px_#00BFFF] animate-[pulse_1.5s_infinite]";
      default:
        return "shadow-[0_0_10px_#7FFFD4]/70";
    }
  };

  // === Voice activation ===
  const handleClick = () => {
    if (!recognitionRef.current) return;

    if (state === "idle") {
      lastTranscriptRef.current = "";
      commandLockRef.current = false;
      recognitionRef.current.start();
    } else {
      recognitionRef.current.stop();
    }
  };

  // === Persona change ===
  const handlePersonaChange = (e) => {
    const newPersona = e.target.value;
    setPersona(newPersona);
    localStorage.setItem("meloPersona", newPersona);
    speak(`Persona set to ${newPersona}`);
  };

  // === Render ===
  return (
    <div className="relative flex items-center space-x-2">
      <div
        title="Talk to Melo"
        onClick={handleClick}
        className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-black border border-white/20 transition-all ${getGlow()}`}
      >
        M
      </div>

      <select
        value={persona}
        onChange={handlePersonaChange}
        className="bg-transparent border border-white/20 text-white text-xs rounded-full px-2 py-1 focus:outline-none"
      >
        <option value="female">🎵 Female</option>
        <option value="male">🎧 Male</option>
      </select>
    </div>
  );
};

export default MeloButton;
