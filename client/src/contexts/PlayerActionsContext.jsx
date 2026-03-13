import { createContext, useContext } from "react";

export const PlayerActionsContext = createContext(null);

export function usePlayerActions() {
  return useContext(PlayerActionsContext);
}
