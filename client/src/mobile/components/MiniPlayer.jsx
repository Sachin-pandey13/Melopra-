import { useNowPlaying } from "../state/useNowPlaying";
import MiniPlayerCollapsed from "./MiniPlayerCollapsed";
import ExpandedPlayer from "./ExpandedPlayer";

export default function MiniPlayer() {
  const { isExpanded, current } = useNowPlaying();

  if (!current) return null;

  return (
    <>
      {!isExpanded && <MiniPlayerCollapsed />}
      {isExpanded && <ExpandedPlayer />}
    </>
  );
}
