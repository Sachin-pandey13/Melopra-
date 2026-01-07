import { createPortal } from "react-dom";
import { useContextMenu } from "../contexts/ContextMenuContext";

const MENU_WIDTH = 224;   // w-56
const MENU_HEIGHT = 168;  // 3 items × ~56px

export default function ContextMenu({
  onAddToQueue,
  onAddToPlaylist,
  onToggleLike,
}) {
  const { menu, closeMenu } = useContextMenu();

  if (!menu.visible || !menu.item) return null;

  const { x, y, item } = menu;

  // 🔒 Viewport-safe positioning
  const safeX = Math.min(
    x,
    window.innerWidth - MENU_WIDTH - 8
  );

  const safeY =
    y + MENU_HEIGHT > window.innerHeight
      ? y - MENU_HEIGHT
      : y;

  return createPortal(
    <div
      className="
        fixed z-[9999]
        bg-zinc-900/95
        backdrop-blur-xl
        border border-white/10
        rounded-xl
        w-56
        shadow-2xl
        overflow-hidden
        animate-scale-in
      "
      style={{ top: safeY, left: safeX }}
      onMouseLeave={closeMenu}
    >
      <MenuButton
        label="➕ Add to Queue"
        onClick={() => onAddToQueue(item)}
        close={closeMenu}
      />

      <MenuButton
        label="📂 Add to Playlist"
        onClick={() => onAddToPlaylist(item)}
        close={closeMenu}
      />

      <MenuButton
        label={item.liked ? "💔 Unlike" : "❤️ Like"}
        onClick={() => onToggleLike(item)}
        close={closeMenu}
      />
    </div>,
    document.body
  );
}

function MenuButton({ label, onClick, close }) {
  return (
    <button
      className="
        w-full px-4 py-3 text-left text-sm
        hover:bg-purple-700/80
        active:bg-purple-800
        transition-colors
      "
      onClick={() => {
        onClick();
        close();
      }}
    >
      {label}
    </button>
  );
}
