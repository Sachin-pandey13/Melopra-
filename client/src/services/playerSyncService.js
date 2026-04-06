import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { usePlayerStore } from "../stores/usePlayerStore";

// Get direct state setter for mobile 
let mobileSetState = null;

let unsubscribeSnapshot = null;
let debounceTimer = null;
let isHydrating = false; 

export function initMobileSync(setStateFn) {
  mobileSetState = setStateFn;
}

export async function startPlayerSync(user) {
  if (!user) return stopPlayerSync();

  const docRef = doc(db, "users", user.uid, "player", "state");

  isHydrating = true;
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      
      // 1. Hydrate history
      if (data.history && Array.isArray(data.history)) {
        localStorage.setItem("melopra_recent_played", JSON.stringify(data.history));
      }
      
      // 2. Hydrate Queue and Current Track (Desktop)
      if (data.currentTrack) {
        usePlayerStore.setState({ 
          currentTrack: data.currentTrack, 
          queue: data.queue || [] 
        });
      }
    }
  } catch (e) {
    console.error("Failed to hydrate player state:", e);
  } finally {
    isHydrating = false;
  }

  // Listen to remote changes to sync across devices dynamically (e.g. tablet -> desktop)
  unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists() || isHydrating) return;
    const data = docSnap.data();
    
    // Only update if it's a newer timestamp
    const localMs = parseInt(localStorage.getItem("melopra_sync_ts") || "0", 10);
    if (data.timestamp && data.timestamp > localMs) {
      if (data.history) {
        localStorage.setItem("melopra_recent_played", JSON.stringify(data.history));
      }
    }
  });
}

export function stopPlayerSync() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = null;
}

// Push local changes to Firestore
export function pushPlayerState(user, stateUpdates) {
  if (!user || isHydrating) return;
  
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const ts = Date.now();
    localStorage.setItem("melopra_sync_ts", ts.toString());
    
    const docRef = doc(db, "users", user.uid, "player", "state");
    setDoc(docRef, { ...stateUpdates, timestamp: ts }, { merge: true })
      .catch(err => console.error("Sync Error:", err));
  }, 3000); // 3s debounce to prevent spamming firestore on skips
}
