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
    // ⚠️ Do NOT capture the pointer here — capturing blocks the parent
    // horizontal scroll container from receiving the touch gesture.
    // We only capture later if we confirm a horizontal-only swipe.

    hasEndedRef.current = false;
    longPressTriggered.current = false;
    isScrollingRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    deltaRef.current = { dx: 0, dy: 0 };

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
    if (hasEndedRef.current || isScrollingRef.current) return;

    const dxVal = e.clientX - startRef.current.x;
    const dyVal = e.clientY - startRef.current.y;
    const absDx = Math.abs(dxVal);
    const absDy = Math.abs(dyVal);

    deltaRef.current = { dx: dxVal, dy: dyVal };

    // Determine scroll direction once we have enough movement
    if (absDx < 6 && absDy < 6) return; // too small to judge yet

    if (absDy > absDx) {
      // Vertical drag → native page scroll wins, release everything
      isScrollingRef.current = true;
      hasEndedRef.current = true;
      setDx(0);
      clearLongPress();
      return;
    }

    // Horizontal drag — check if we're inside a horizontally-scrollable
    // container (i.e. an album row). If yes, let the container scroll instead
    // of handling it as a swipe gesture.
    const scrollParent = e.currentTarget.closest('[data-allow-swipe="true"]');
    if (!scrollParent) {
      // We are inside a horizontal scroll row — release so row can scroll
      isScrollingRef.current = true;
      hasEndedRef.current = true;
      setDx(0);
      clearLongPress();
      return;
    }

    // We are in a vertical list with swipe enabled — take over the pointer
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setDx(dxVal);

    // Cancel long press if user starts dragging
    if (absDx > TAP_THRESHOLD || absDy > TAP_THRESHOLD) {
      clearLongPress();
    }
  };

  /* ---------- POINTER END ---------- */
  const onPointerUp = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    clearLongPress();

    const { dx: finalDx, dy: finalDy } = deltaRef.current;

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
        transform: `translateX(${dx}px) scale(${longPressActive ? 0.96 : 1})`,
        transition: "transform 180ms ease",
        boxShadow: longPressActive
          ? "0 0 0 2px #4da6ff, 0 8px 24px rgba(77,166,255,0.3)"
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
