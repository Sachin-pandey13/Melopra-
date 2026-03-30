import { useState, useRef } from "react";

const SWIPE_THRESHOLD = 40;
const TAP_THRESHOLD = 8;
const LONG_PRESS_MS = 500;

export default function InteractiveItem({
  item,
  children,
  onPress,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
}) {
  const [pressed, setPressed] = useState(false);
  const [dx, setDx] = useState(0);
  const [longPressActive, setLongPressActive] = useState(false);

  const startRef = useRef({ x: 0, y: 0 });
  const deltaRef = useRef({ dx: 0, dy: 0 });
  const hasEndedRef = useRef(false);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const isScrollingRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressActive(false);
  };

  /* ---------- POINTER START ---------- */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    hasEndedRef.current = false;
    longPressTriggered.current = false;
    isScrollingRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    deltaRef.current = { dx: 0, dy: 0 };

    setPressed(true);

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      if (isScrollingRef.current) return;
      longPressTriggered.current = true;
      setLongPressActive(true);
      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(40);
      onLongPress?.(item);
      // Reset visual after a moment
      setTimeout(() => setLongPressActive(false), 300);
    }, LONG_PRESS_MS);
  };

  /* ---------- POINTER MOVE ---------- */
  const onPointerMove = (e) => {
    if (!pressed || hasEndedRef.current || isScrollingRef.current) return;

    const dxVal = e.clientX - startRef.current.x;
    const dyVal = e.clientY - startRef.current.y;

    deltaRef.current = { dx: dxVal, dy: dyVal };

    // Detect if user is scrolling vertically
    if (Math.abs(dyVal) > TAP_THRESHOLD && Math.abs(dyVal) > Math.abs(dxVal)) {
      isScrollingRef.current = true;
      hasEndedRef.current = true;
      setPressed(false);
      setDx(0);
      clearLongPress();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      return;
    }

    setDx(dxVal);

    // Cancel long press if user starts dragging
    if (Math.abs(dxVal) > TAP_THRESHOLD || Math.abs(dyVal) > TAP_THRESHOLD) {
      clearLongPress();
    }
  };

  /* ---------- POINTER END ---------- */
  const onPointerUp = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    clearLongPress();

    const { dx: finalDx, dy: finalDy } = deltaRef.current;

    setPressed(false);
    setDx(0);
    deltaRef.current = { dx: 0, dy: 0 };

    // If long press triggered, don't do swipe/tap
    if (longPressTriggered.current) return;

    const absDx = Math.abs(finalDx);
    const absDy = Math.abs(finalDy);

    if (finalDx > SWIPE_THRESHOLD) return onSwipeRight?.(item);
    if (finalDx < -SWIPE_THRESHOLD) return onSwipeLeft?.(item);

    if (absDx < TAP_THRESHOLD && absDy < TAP_THRESHOLD) {
      onPress?.(item);
    }
  };

  /* ---------- SWIPE HINT ---------- */
  const hint =
    dx > SWIPE_THRESHOLD
      ? { text: "Queue", color: "#1db954" }
      : dx < -SWIPE_THRESHOLD
      ? { text: "Like", color: "#ff4d8d" }
      : null;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        transform: `translateX(${dx}px) scale(${longPressActive ? 0.94 : pressed ? 1.03 : 1})`,
        transition: pressed ? "transform 60ms ease" : "transform 180ms ease",
        boxShadow: longPressActive
          ? "0 0 0 2px #4da6ff, 0 8px 24px rgba(77,166,255,0.3)"
          : pressed
          ? "0 8px 20px rgba(0,0,0,0.4)"
          : "none",
        borderRadius: 12,
        touchAction: "pan-y",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
      }}
    >
      {/* Swipe hint label */}
      {hint && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: hint.text === "Queue" ? -60 : "auto",
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

      {/* Long-press ripple overlay */}
      {longPressActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            background: "rgba(77,166,255,0.18)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      {children}
    </div>
  );
}
