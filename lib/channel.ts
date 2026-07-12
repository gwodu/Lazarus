import type { DisplayMessage, Passage } from "./types";
import { DISPLAY_CHANNEL, DISPLAY_STORAGE_KEY } from "./types";

/** Sends a message to every open display window and persists the current
 * state so a display opened later shows the right thing immediately. */
export function sendToDisplay(message: DisplayMessage) {
  if (message.type === "show") {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(message.passage));
  } else {
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
  }
  const channel = new BroadcastChannel(DISPLAY_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

/** Subscribes to display messages. Returns an unsubscribe function. */
export function onDisplayMessage(handler: (message: DisplayMessage) => void) {
  const channel = new BroadcastChannel(DISPLAY_CHANNEL);
  channel.onmessage = (event) => handler(event.data as DisplayMessage);
  return () => channel.close();
}

/** Reads the persisted passage, for displays opened mid-service. */
export function readCurrentPassage(): Passage | null {
  const raw = localStorage.getItem(DISPLAY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Passage;
  } catch {
    return null;
  }
}
