import { useEffect } from "react";
import { useNowPlaying, setBackdropColor } from "../state/useNowPlaying";

export default function PlayerBackdrop() {
  const { current, isExpanded } = useNowPlaying();

  // 🎨 EXTRACT COLOR ON TRACK CHANGE (ONCE)
  useEffect(() => {
    if (!current?.image) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = current.image;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = canvas.height = 32;
      ctx.drawImage(img, 0, 0, 32, 32);

      const { data } = ctx.getImageData(0, 0, 32, 32);

      let r = 0,
        g = 0,
        b = 0;

      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }

      const pxCount = data.length / 4;
      r = Math.round(r / pxCount);
      g = Math.round(g / pxCount);
      b = Math.round(b / pxCount);

      setBackdropColor(`rgb(${r}, ${g}, ${b})`);
    };
  }, [current?.image]);

  // ❌ DO NOT RENDER BACKDROP IF NOT EXPANDED
  if (!current || !isExpanded) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 998,

        // subtle depth only — NOT a second background
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",

        pointerEvents: "none",
      }}
    />
  );
}
