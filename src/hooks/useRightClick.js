import { useContextMenu } from "../contexts/ContextMenuContext";

export default function useRightClick(item) {
  const { openMenu } = useContextMenu();

  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    openMenu(e.clientX, e.clientY, item);
  };

  return { onContextMenu };
}
