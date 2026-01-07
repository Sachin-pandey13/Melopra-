
import { create } from "zustand";

export const usePlayerStore = create((set, get) => ({
  // Playback state
  currentTrack: null,
  isPlaying: false,
  queue: [],

  // Actions
  setTrack: (track) => set({ currentTrack: track, isPlaying: true }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  enqueue: (track) => set((state) => ({ queue: [...state.queue, track] })),
  dequeue: () => {
    const { queue } = get();
    if (queue.length === 0) return null;
    const [next, ...rest] = queue;
    set({ queue: rest, currentTrack: next, isPlaying: true });
    return next;
  },
  clearQueue: () => set({ queue: [] }),
}));
