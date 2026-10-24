const STORAGE_KEY = "vocalearn-game-audio-muted";
const CHANGE_EVENT = "vocalearn:game-audio-preference";
let fallbackMuted = false;

export function getAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return fallbackMuted;
  }
}

export function setAudioMuted(muted: boolean) {
  fallbackMuted = muted;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    /* Keep the in-memory preference when storage is unavailable. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAudioMuted(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", storage);
  };
}
