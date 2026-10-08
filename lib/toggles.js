import { useSyncExternalStore } from "react";
import { api, onSessionEnd } from "./api";

/**
 * Shared on/off state for venue favorites and event interests, so a star or
 * check changed on one screen is the same on every other screen.
 */
function createToggleStore({ endpoint, responseKey }) {
  const values = new Map();
  const listeners = new Set();

  const emit = () => listeners.forEach((listener) => listener());

  // Forget everything on sign-out (the next account starts clean)
  onSessionEnd(() => {
    values.clear();
    emit();
  });
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    /** Store values reported by the API, e.g. seed(venues, "is_favorite"). */
    seed(items, flagKey) {
      items.forEach((item) => values.set(String(item.id), !!item[flagKey]));
      emit();
    },

    /** Mark ids as on, e.g. from the profile's favorite_ids. */
    seedIds(ids) {
      ids.forEach((id) => values.set(String(id), true));
      emit();
    },

    /** Optimistically flips the value, then confirms it with the API. */
    async toggle(id) {
      const key = String(id);
      const previous = !!values.get(key);
      values.set(key, !previous);
      emit();

      try {
        const result = await api(endpoint(key), { method: previous ? "DELETE" : "PUT" });
        values.set(key, !!result[responseKey]);
      } catch (error) {
        values.set(key, previous);
        console.error(`Failed to update ${responseKey}:`, error.message);
      }
      emit();
    },

    useValue(id) {
      return useSyncExternalStore(subscribe, () => !!values.get(String(id)));
    },
  };
}

export const favorites = createToggleStore({
  endpoint: (venueId) => `/api/venues/${venueId}/favorite`,
  responseKey: "is_favorite",
});

export const interests = createToggleStore({
  endpoint: (eventId) => `/api/events/${eventId}/interest`,
  responseKey: "is_interested",
});
