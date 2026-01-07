import React from "react";
import { motion } from "framer-motion";

export default function MeloWaveform({ playing = true }) {
  const bars = new Array(7).fill(0);
  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          animate={ playing ? { height: ["6px", `${6 + (i % 4) * 8}px`, "6px"] } : { height: "6px" } }
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.08, ease: "easeInOut" }}
          className="w-1.5 bg-gradient-to-b from-[#7AEAE0] to-[#3dd6c9] rounded-sm"
        />
      ))}
    </div>
  );
}
