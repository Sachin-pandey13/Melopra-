// src/components/PreviewPlayer.jsx
import { useEffect, useRef } from "react";

export default function PreviewPlayer({ track }) {
  const audioRef = useRef();

  useEffect(() => {
    if (track?.preview_url && audioRef.current) {
      audioRef.current.src = track.preview_url;
      audioRef.current.play();
    }
  }, [track]);

  if (!track) return null;

  return (
    <div className="p-4 text-white">
      <h2 className="text-lg font-semibold">{track.name}</h2>
      <p className="text-sm">{track.artists[0].name}</p>
      <audio controls ref={audioRef} className="mt-2 w-full" />
    </div>
  );
}
