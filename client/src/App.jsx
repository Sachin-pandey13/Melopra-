import { useIsMobile } from "./hooks/useIsMobile";
import DesktopHome from "./layouts/DesktopHome";
import MobileHome from "./mobile/MobileHome";
import { playItem, enqueue } from "./mobile/state/useNowPlaying";
import { allItems } from "./mobile/data/allItems";
import { useAuth } from "./contexts/AuthContext";
import useLibraryController from "./hooks/useLibraryController";

export default function App() {
  const isMobile = useIsMobile();
  const { currentUser } = useAuth();
  const library = useLibraryController({ currentUser });

  const actions = {
    play: (item) => {
      if (!item || !item.id) return;

      // 🔒 prevent duplicate rapid replays
      if (window.__LAST_PLAY_ID === item.id) return;
      window.__LAST_PLAY_ID = item.id;

      console.log("PLAY HIT:", item.title);
      playItem({ ...item }); // ✅ CLONE AGAIN
    },

    addToQueue: (item) => {
      if (!item || !item.id) return;

      console.log("ENQUEUED:", item.title);
      enqueue(item);
    },

    toggleLike: (item) => {
      if (!item || !item.id) return;
      library.toggleFavorite(item);
    },

    addToPlaylist: (item) => {
      if (!item || !item.id) return;
      library.openAddToPlaylist(item);
    },
  };

  return isMobile ? (
    <MobileHome allItems={allItems} actions={actions} library={library} />
  ) : (
    <DesktopHome />
  );
}
