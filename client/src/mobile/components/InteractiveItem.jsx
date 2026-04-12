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
  // ─────────────────────────────────────────────────────────────────────────
  // noSwipe={true}  →  used by HorizontalSection (album rows)
  //   • touchAction: "auto"  — browser handles horizontal scroll freely
  //   • No pointer capture, no swipe gestures, only tap (onClick)
  //
  // noSwipe={false} →  used by VerticalList (search results, library)
  //   • touchAction: "pan-y" — swipe-left/right gestures work for queue/like
  // ─────────────────────────────────────────────────────────────────────────
  noSwipe = false,
}) {
  // ─── noSwipe (horizontal row) path ───────────────────────────────────────
  // Pure tap button. touchAction: "auto" lets the parent scroll row receive
  // all horizontal touch events without any JavaScript interference.
  if (noSwipe) {
    return (
      <div
        onClick={() => onPress?.(item)}
        style={{
          position: "relative",
          borderRadius: 12,
          touchAction: "auto",          // ← KEY: browser handles scroll freely
          WebkitTapHighlightColor: "transparent",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {children}
      </div>
    );
  }

  // ─── Full swipe mode (vertical list) path ────────────────────────────────
  return <SwipeItem item={item} onPress={onPress} onSwipeRight={onSwipeRight}
           onSwipeLeft={onSwipeLeft} onLongPress={onLongPress}>{children}</SwipeItem>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SwipeItem — the original full gesture component, used only in VerticalList
───────────────────────────────────────────────────────────────────────────── */
function SwipeItem({ item, children, onPress, onSwipeRight, onSwipeLeft, onLongPress }) {
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

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    hasEndedRef.current = false;
    longPressTriggered.current = false;
    isScrollingRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    deltaRef.current = { dx: 0, dy: 0 };

    longPressTimer.current = setTimeout(() => {
      if (isScrollingRef.current) return;
      longPressTriggered.current = true;
      setLongPressActive(true);
      if (navigator.vibrate) navigator.vibrate(40);
      onLongPress?.(item);
      setTimeout(() => setLongPressActive(false), 300);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    if (hasEndedRef.current || isScrollingRef.current) return;
    const dxVal = e.clientX - startRef.current.x;
    const dyVal = e.clientY - startRef.current.y;
    deltaRef.current = { dx: dxVal, dy: dyVal };

    // Release to vertical page scroll if finger moves up/down
    if (Math.abs(dyVal) > 8 && Math.abs(dyVal) > Math.abs(dxVal)) {
      isScrollingRef.current = true;
      hasEndedRef.current = true;
      setDx(0);
      clearLongPress();
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      return;
    }

    setDx(dxVal);
    if (Math.abs(dxVal) > TAP_THRESHOLD || Math.abs(dyVal) > TAP_THRESHOLD) clearLongPress();
  };

  const onPointerUp = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    clearLongPress();

    const { dx: finalDx, dy: finalDy } = deltaRef.current;
    setDx(0);
    deltaRef.current = { dx: 0, dy: 0 };

    if (longPressTriggered.current) return;

    if (finalDx > SWIPE_THRESHOLD) return onSwipeRight?.(item);
    if (finalDx < -SWIPE_THRESHOLD) return onSwipeLeft?.(item);
    if (Math.abs(finalDx) < TAP_THRESHOLD && Math.abs(finalDy) < TAP_THRESHOLD) onPress?.(item);
  };

  const hint =
    dx > SWIPE_THRESHOLD ? { text: "Queue", color: "#1db954" } :
    dx < -SWIPE_THRESHOLD ? { text: "Like", color: "#ff4d8d" } : null;

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
        boxShadow: longPressActive ? "0 0 0 2px #4da6ff, 0 8px 24px rgba(77,166,255,0.3)" : "none",
        borderRadius: 12,
        touchAction: "pan-y",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
      }}
    >
      {hint && (
        <div style={{
          position: "absolute", top: "50%",
          left: hint.text === "Queue" ? -60 : "auto",
          right: hint.text === "Like" ? -60 : "auto",
          transform: "translateY(-50%)",
          fontSize: 12, fontWeight: 600, color: hint.color,
          pointerEvents: "none", opacity: 0.9,
        }}>{hint.text}</div>
      )}
      {longPressActive && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 12,
          background: "rgba(77,166,255,0.18)",
          pointerEvents: "none", zIndex: 2,
        }} />
      )}
      {children}
    </div>
  );
}
