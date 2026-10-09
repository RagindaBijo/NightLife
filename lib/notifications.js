import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api, onSessionEnd } from "./api";

/**
 * Unread notifications (follow requests, new followers, likes), for the badge
 * on the bell. Checked every minute while the app is open, and right away when
 * the notifications screen calls refreshNotificationCount().
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

export function setNotificationCount(next) {
  if (next !== count) {
    count = next;
    emit();
  }
}

export async function refreshNotificationCount() {
  try {
    const { count: next } = await api("/api/notifications/unread");
    setNotificationCount(next ?? 0);
  } catch {
    // offline or logged out – keep the last value
  }
}

export const useNotificationCount = () => useSyncExternalStore(subscribe, () => count);

/** Keeps the count fresh while the app is in the foreground. */
export function useNotificationPolling({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const start = () => {
      refreshNotificationCount();
      clearInterval(timer);
      timer = setInterval(refreshNotificationCount, POLL_MS);
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
