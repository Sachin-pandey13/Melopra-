import { useEffect, useRef } from "react";

export default function WaveformVisualizer() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Optional: clear canvas in case it had something before
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-32"
        style={{ position: "absolute", bottom: "0" }}
      />
    </div>
  );
}
