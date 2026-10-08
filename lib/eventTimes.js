// Keep in sync with EVENT_LISTED_HOURS in the worker (api/src/shared.js)
export const EVENT_LISTED_HOURS = 8;

/** Events that started before this moment are over (nights run late). */
export const upcomingCutoffMs = (now = Date.now()) => now - EVENT_LISTED_HOURS * 3600 * 1000;
