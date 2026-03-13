import { useNowPlaying } from "../state/useNowPlaying";

export default function GlobalBackdrop({ intensity = 50, opacity = 0.9 }) {
  const { current } = useNowPlaying();

  if (!current?.image) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        backgroundImage: `url(${current.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: `blur(${intensity}px)`,
        transform: "scale(1.25)",
        opacity,
      }}
    >
      {/* single dark wash – same everywhere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
        }}
      />
    </div>
  );
}
