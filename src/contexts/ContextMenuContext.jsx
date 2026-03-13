import { createContext, useContext, useState, useCallback } from "react";

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
  const [menu, setMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  const openMenu = useCallback((x, y, item) => {
    setMenu({
      visible: true,
      x,
      y,
      item,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, []);

  return (
    <ContextMenuContext.Provider value={{ menu, openMenu, closeMenu }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("useContextMenu must be used inside ContextMenuProvider");
  }
  return ctx;
}
