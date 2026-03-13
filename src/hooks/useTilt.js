import { useRef, useEffect, useState } from "react";

export function useTilt(maxTilt = 15) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseMove = (e) => {
      const rect = node.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setTilt({ rotateX, rotateY });
    };

    const resetTilt = () => setTilt({ rotateX: 0, rotateY: 0 });

    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("mouseleave", resetTilt);

    return () => {
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("mouseleave", resetTilt);
    };
  }, [maxTilt]);

  return [ref, tilt];
}
