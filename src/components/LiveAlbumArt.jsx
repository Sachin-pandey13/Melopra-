import { useRef } from "react";
import Tilt from "react-parallax-tilt";
import "../styles/LiveAlbumArt.css";

export default function LiveAlbumArt({
  audioRef,
  isPlaying,
  setIsPlaying,
  onPlay,
  album,
  mode = "select", // "select" | "active"
  onAlbumSelect,
}) {
  const cardRef = useRef(null);
  const isActive = mode === "active";

  const handleClick = () => {
    if (isActive) {
      onPlay(); // immersive play/pause
    } else if (onAlbumSelect) {
      onAlbumSelect(album); // select this album
    }
  };

  const handleMouseMove = (e) => {
    if (!isActive) return;

    const card = cardRef.current;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    const centerX = width / 2;
    const centerY = height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (x - centerX) / 10;
    card.style.transform = `rotateX(${-rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const resetRotation = () => {
    if (!isActive) return;
    cardRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div className="album-art-wrapper relative w-full flex justify-center items-center">
      {/* 🔮 Ripple + Glow only in active immersive mode */}
      {isPlaying && isActive && (
        <div className="absolute w-52 h-52 rounded-full animate-ripple aura-glow z-0" />
      )}

      {/* 🎵 Album Card */}
      <div
        ref={cardRef}
        className={`album-art-card relative z-10 cursor-pointer ${
          isPlaying && isActive ? "subtle-pop-glow" : ""
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={resetRotation}
        onClick={handleClick}
      >
        <Tilt
          glareEnable={isPlaying && isActive}
          tiltMaxAngleX={isActive ? 15 : 0}
          tiltMaxAngleY={isActive ? 15 : 0}
          scale={1}
          transitionSpeed={250}
        >
          <img
            src={album.image}
            alt={album.title}
            className={`w-44 h-44 rounded-xl shadow-2xl object-cover border-4 ${
              isPlaying && isActive
                ? "border-purple-400"
                : "border-gray-700 opacity-80 hover:opacity-100 transition"
            }`}
          />
        </Tilt>
      </div>
    </div>
  );
}
