import React from "react";
import { motion } from "framer-motion";
import { useMelo } from "./MeloProvider";
import MeloWaveform from "./MeloWaveform";

export default function MeloOrb() {
  const { isOpen, close, mode, setMode } = useMelo();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.18 }}
      className="fixed bottom-6 right-6 z-50 w-[320px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
    >
      {/* header: avatar + persona + close */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#7AEAE0] flex items-center justify-center text-sm font-semibold text-gray-800">
            M
          </div>
          <div>
            <div className="text-sm font-semibold">Melo</div>
            <div className="text-xs text-gray-500">Your music assistant</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* persona dropdown placeholder */}
          <select
            className="text-xs py-1 px-2 rounded-md border"
            onChange={(e) => {
              // store persona in localStorage for now - backend will be next step
              localStorage.setItem("melo_persona", e.target.value);
            }}
            defaultValue={localStorage.getItem("melo_persona") || "male"}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <button onClick={close} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>
      </div>

      {/* main area: waveform + status text + mic controls */}
      <div className="flex items-center justify-center flex-col gap-3">
        <MeloWaveform playing={mode === "listening" || mode === "thinking"} />

        <div className="text-sm text-gray-700">
          {mode === "idle" && "Tap mic and speak"}
          {mode === "listening" && "Listening..."}
          {mode === "thinking" && "Thinking..."}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode(mode === "listening" ? "idle" : "listening")}
            className="px-4 py-2 rounded-full bg-[#7AEAE0] text-white font-medium"
          >
            {mode === "listening" ? "Stop" : "Speak"}
          </button>

          <button
            onClick={() => setMode("thinking")}
            className="px-3 py-2 rounded-full border text-sm"
          >
            Simulate
          </button>
        </div>
      </div>

      {/* footer small hint */}
      <div className="text-xs text-gray-400">
        Melo responds in chosen persona. No chat history — voice only.
      </div>
    </motion.div>
  );
}
