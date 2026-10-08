import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api, onSessionEnd } from "./api";

/**
 * Unread messages + waiting chat requests, for the badge on the Chat tab.
 * Checked every minute while the app is open, and right away when chat
 * screens call refreshUnread() (after reading or answering something).
 */
const POLL_MS = 60000;

let count = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

onSessionEnd(() => {
  count = 0;
  emit();
});

export async function refreshUnread() {
  try {
    const { messages, requests } = await api("/api/chats/unread");
    const next = (messages ?? 0) + (requests ?? 0);
    if (next !== count) {
      count = next;
      emit();
    }
  } catch {
    // offline or logged out – keep the last value
  }
}

export const useUnreadCount = () => useSyncExternalStore(subscribe, () => count);

/** Keeps the count fresh while the app is in the foreground. */
export function useUnreadPolling({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const start = () => {
      refreshUnread();
      clearInterval(timer);
      timer = setInterval(refreshUnread, POLL_MS);
    };
    const stop = () => clearInterval(timer);

    start();
    // No checks while the app is in the background
    const subscription = AppState.addEventListener("change", (state) =>
      state === "active" ? start() : stop(),
    );
    return () => {
      stop();
      subscription.remove();
    };
  }, [enabled]);
}
