import React, { createContext, useContext, useState } from "react";

const MeloContext = createContext();

export function useMelo() {
  return useContext(MeloContext);
}

/**
 * provider keeps track of:
 * - isOpen: whether the orb is open
 * - mode: "idle" | "listening" | "thinking"
 */
export function MeloProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("idle"); // idle | listening | thinking

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  const value = {
    isOpen,
    open,
    close,
    toggle,
    mode,
    setMode
  };

  return <MeloContext.Provider value={value}>{children}</MeloContext.Provider>;
}
