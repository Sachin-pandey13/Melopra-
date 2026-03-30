import { useSyncExternalStore } from "react";

let state = {
  currentTime: 0,
  duration: 0,
};

const listeners = new Set();
function emit() { listeners.forEach(l => l()); }

export function setPlayerTime(currentTime, duration) {
  // avoid strict equality re-renders if nothing changed much
  if (Math.abs(state.currentTime - currentTime) < 0.1 && state.duration === duration) return;
  
  state = { currentTime, duration };
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() { 
  return state; 
}

export function usePlayerTime() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// For requesting seek from UI to Player engine
let seekListener = null;

export function setSeekListener(listener) { 
  seekListener = listener; 
}

export function requestSeek(time) { 
  if (seekListener) seekListener(time); 
}
