import { useRef, useState } from "react";
import {
  useNowPlaying,
  closePlayer,
  togglePlay,
  playNext,
  playPrevious,
  moveQueueItemToNext,
  reorderQueue,
  removeFromQueue,
  shuffleQueue,
  toggleRepeat,          
} from "../state/useNowPlaying";

/* ---------------- CONSTANTS ---------------- */

const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 0.5;
const MAX_DRAG = 100;

/* ---------------- COMPONENT ---------------- */

export default function ExpandedPlayer() {
  const { current, isPlaying, queue, isSmartLoading } = useNowPlaying();

  const startY = useRef(0);
  const startTime = useRef(0);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const [dragIndex, setDragIndex] = useState(null);
  const [liked, setLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const { repeatMode, repeatOnce } = useNowPlaying();
  const [showLyrics, setShowLyrics] = useState(false);
  const [pressed, setPressed] = useState(false);

  if (!current) return null;

  /* ---------- GESTURES ---------- */

  function onPointerDown(e) {
    if (e.target.closest("button")) return;
    startY.current = e.clientY;
    startTime.current = performance.now();
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const delta = e.clientY - startY.current;
    if (delta > 0) setDragY(Math.min(delta, MAX_DRAG));
  }

  function onPointerUp(e) {
    if (!dragging) return;
    setDragging(false);

    const deltaY = e.clientY - startY.current;
    const deltaTime = performance.now() - startTime.current;
    const velocity = deltaY / deltaTime;

    if (deltaY > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) {
      closePlayer();
    }

    setDragY(0);
  }

  /* ---------------- RENDER ---------------- */

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        color: "#fff",
        transform: `translateY(${dragY}px)`,
        transition: dragging ? "none" : "transform 220ms ease-out",
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
      }}
    >
      {/* BLURRED BACKDROP */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          backgroundImage: `url(${current.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(50px)",
          transform: "scale(1.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background: "rgba(0,0,0,0.6)",
        }}
      />

      {/* TOP BAR */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
        }}
      >
        <button
          onClick={closePlayer}
          style={topButton}
        >
          ↓
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={dragHandle} />
        </div>

        <button style={topButton}>⋮</button>
      </div>

      {/* CONTENT */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 48,
        }}
      >
        {/* ART */}
        <img
          src={current.image}
          alt=""
          draggable={false}
          style={artStyle}
        />

        {/* META */}
        <div style={{ textAlign: "center" }}>
          {isSmartLoading && (
            <div style={{ color: "#1DB954", fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
              SMART DISCOVERY ACTIVE
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {current.title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {current.artist}
          </div>
        </div>

        {/* PROGRESS */}
        <div style={{ width: "80%" }}>
          <div style={progressTrack}>
            <div style={progressFill} />
          </div>
        </div>

{/* ACTION ROW */}
<div style={actionRow}>
  {/* Like */}
  <ActionIcon onClick={() => setLiked(!liked)}>
    {liked ? "❤️" : "♡"}
  </ActionIcon>

  {/* Repeat */}
  <ActionIcon onClick={toggleRepeat}>
  {repeatMode === "one" && repeatOnce
    ? "🔂1"        // repeat once
    : repeatMode === "one"
    ? "🔂"         // repeat infinite
    : repeatMode === "all"
    ? "🔁"         // repeat all
    : "↻"}         
</ActionIcon>


  {/* Queue */}
  <ActionIcon onClick={() => setShowQueue(true)}>
    ☰
  </ActionIcon>

  {/* Lyrics */}
  <ActionIcon onClick={() => setShowLyrics(!showLyrics)}>
    🎤
  </ActionIcon>
</div>

      {/* CONTROLS */}
<div
  style={{
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: 16,
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 70,
      padding: "14px 36px",
      borderRadius: 999, // 🔑 elongated pill
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    }}
  >
    {/* PREVIOUS */}
    <CircleControl onClick={playPrevious} dark>
      <PrevIcon />
    </CircleControl>

    {/* PLAY / PAUSE */}
    <CircleControl
      onClick={() => {
        setPressed(true);
        togglePlay();
        setTimeout(() => setPressed(false), 120);
      }}
      primary
      pressed={pressed}
    >
      <PlayPauseIcon playing={isPlaying} />
    </CircleControl>

    {/* NEXT */}
    <CircleControl 
      onClick={playNext} 
      dark 
      disabled={isSmartLoading}
      style={{ opacity: isSmartLoading ? 0.3 : 1 }}
    >
      {isSmartLoading ? "..." : <NextIcon />}
    </CircleControl>
  </div>
</div>



        {/* LYRICS PREVIEW */}
        {showLyrics && (
          <div style={lyricsPanel}>
            <div style={{ opacity: 0.6, marginBottom: 8 }}>
              Lyrics preview
            </div>
            <div style={{ fontSize: 14 }}>
              🎶 Lyrics integration coming soon…
            </div>
          </div>
        )}
      </div>

{/* QUEUE PANEL */}
{showQueue && (
  <div
    onClick={() => setShowQueue(false)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(0,0,0,0.4)",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "60%",
        background: "rgba(15,15,15,0.95)",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
        overflowY: "auto",
      }}
    >
      {/* drag handle */}
      <div
        style={{
          width: 40,
          height: 4,
          background: "rgba(255,255,255,0.3)",
          borderRadius: 4,
          margin: "0 auto 12px",
        }}
      />

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>Up Next</div>

        <button
          onClick={shuffleQueue}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            opacity: 0.7,
            cursor: "pointer",
          }}
        >
          Shuffle
        </button>
      </div>

      {queue.length === 0 && (
        <div style={{ opacity: 0.6, fontSize: 14 }}>
          Queue is empty
        </div>
      )}

      {queue.map((item, i) => {
        const isNowPlaying = item.id === current?.id;
        const isDragging = dragIndex === i;

        return (
          <div
            key={i}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) {
                reorderQueue(dragIndex, i);
                setDragIndex(null);
              }
            }}
            onClick={() => moveQueueItemToNext(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              opacity: isDragging ? 0.5 : isNowPlaying ? 0.6 : 1,
            }}
          >
            {/* DRAG HANDLE */}
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragIndex(i);
              }}
              onDragEnd={() => setDragIndex(null)}
              style={{
                cursor: "grab",
                opacity: 0.4,
                fontSize: 16,
                paddingRight: 6,
              }}
            >
              ☰
            </div>

            <img
              src={item.image}
              alt=""
              style={{
                width: 42,
                height: 42,
                borderRadius: 6,
                objectFit: "cover",
              }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>
                {item.title}
                {isNowPlaying && (
                  <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.5 }}>
                    • Now playing
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {item.artist}
              </div>
            </div>

            {/* REMOVE */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromQueue(i);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                opacity: 0.4,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  </div>
)}


   </div>
  );
}

/* ---------------- STYLES ---------------- */

const topButton = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
};

const dragHandle = {
  width: 40,
  height: 4,
  borderRadius: 4,
  background: "rgba(255,255,255,0.35)",
};

const artStyle = {
  width: "70%",
  maxWidth: 320,
  borderRadius: 20,
  marginTop: 12,
  boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
};

const progressTrack = {
  height: 3,
  background: "rgba(255,255,255,0.2)",
  borderRadius: 3,
};

const progressFill = {
  width: "35%",
  height: "100%",
  background: "#fff",
  borderRadius: 3,
};

const actionRow = {
  width: "85%",
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 18px",
  borderRadius: 14,
  background: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};


const controls = {
  display: "flex",
  alignItems: "center",
  gap: 36,
};

const playButton = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  border: "none",
  background: "#fff",
  color: "#000",
  cursor: "pointer",
  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
  margin: "0 6px",
};


const lyricsPanel = {
  marginTop: 18,
  width: "85%",
  padding: 16,
  borderRadius: 14,
  background: "rgba(0,0,0,0.45)",
  textAlign: "center",
};

/* ---------------- HELPERS ---------------- */

function ActionIcon({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: 20,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
function PlayPauseIcon({ playing, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block" }}
    >
      {playing ? (
        <>
          <rect x="6" y="4" width="4" height="16" rx="1.5" fill="#000" />
          <rect x="14" y="4" width="4" height="16" rx="1.5" fill="#000" />
        </>
      ) : (
        <polygon points="8,5 20,12 8,19" fill="#000" />
      )}
    </svg>
  );
}


function PrevIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="rgba(255,255,255,0.9)"
    >
      <polygon points="11,12 21,4 21,20" />
      <polygon points="3,12 13,4 13,20" />
    </svg>
  );
}

function NextIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="rgba(255,255,255,0.9)"
    >
      <polygon points="3,4 13,12 3,20" />
      <polygon points="11,4 21,12 11,20" />
    </svg>
  );
}


function ControlIcon({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: 22,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CircleControl({
  children,
  onClick,
  primary = false,
  dark = false,
  pressed = false,
}) {
  const size = primary ? 64 : 46;

  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        background: primary
          ? "#fff"
          : dark
          ? "rgba(0,0,0,0.6)"
          : "transparent",

        boxShadow: primary
          ? "0 10px 30px rgba(0,0,0,0.6)"
          : "none",

        transform: pressed ? "scale(0.92)" : "scale(1)",
        transition: "transform 120ms ease",

        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
