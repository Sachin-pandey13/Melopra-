import { useState, useRef } from "react";

const SWIPE_THRESHOLD = 40;
const TAP_THRESHOLD = 8;

export default function InteractiveItem({
  item,
  children,
  onPress,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
}) {
  const [pressed, setPressed] = useState(false);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);

  const startRef = useRef({ x: 0, y: 0 });
  const deltaRef = useRef({ dx: 0, dy: 0 });
  const hasEndedRef = useRef(false);

  /* ---------- POINTER START ---------- */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    hasEndedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    deltaRef.current = { dx: 0, dy: 0 };

    setPressed(true);
  };

  /* ---------- POINTER MOVE ---------- */
  const onPointerMove = (e) => {
    if (!pressed || hasEndedRef.current) return;

    const dxVal = e.clientX - startRef.current.x;
    const dyVal = e.clientY - startRef.current.y;

    deltaRef.current = { dx: dxVal, dy: dyVal };
    setDx(dxVal);
    setDy(dyVal);
  };

  /* ---------- POINTER END ---------- */
  const onPointerUp = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    const { dx: finalDx, dy: finalDy } = deltaRef.current;

    // reset visuals FIRST
    setPressed(false);
    setDx(0);
    setDy(0);
    deltaRef.current = { dx: 0, dy: 0 };

    const absDx = Math.abs(finalDx);
    const absDy = Math.abs(finalDy);

    if (finalDx > SWIPE_THRESHOLD) return onSwipeRight?.(item);
    if (finalDx < -SWIPE_THRESHOLD) return onSwipeLeft?.(item);
    if (finalDy < -SWIPE_THRESHOLD) return onSwipeUp?.(item);

    if (absDx < TAP_THRESHOLD && absDy < TAP_THRESHOLD) {
      onPress?.(item); // ✅ ALWAYS the correct item
    }
  };

  /* ---------- HINT ---------- */
  const hint =
    dx > SWIPE_THRESHOLD
      ? { text: "Queue", color: "#1db954" }
      : dx < -SWIPE_THRESHOLD
      ? { text: "Like", color: "#ff4d8d" }
      : dy < -SWIPE_THRESHOLD
      ? { text: "Playlist", color: "#4da6ff" }
      : null;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        transform: `translate(${dx}px, ${dy}px) scale(${pressed ? 1.03 : 1})`,
        transition: pressed ? "none" : "transform 180ms ease",
        boxShadow: pressed
          ? "0 8px 20px rgba(0,0,0,0.4)"
          : "none",
        borderRadius: 12,
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
      }}
    >
      {hint && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: hint.text === "Queue" ? -60 : "50%",
            right: hint.text === "Like" ? -60 : "auto",
            transform: "translateY(-50%)",
            fontSize: 12,
            fontWeight: 600,
            color: hint.color,
            pointerEvents: "none",
            opacity: 0.9,
          }}
        >
          {hint.text}
        </div>
      )}

      {children}
    </div>
  );
}
