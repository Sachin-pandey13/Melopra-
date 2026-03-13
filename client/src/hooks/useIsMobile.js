import { useEffect, useState } from "react";

export function useIsMobile() {
  const getMatch = () =>
    window.matchMedia("(max-width: 768px)").matches;

  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");

    const listener = () => setIsMobile(media.matches);

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return isMobile;
}
