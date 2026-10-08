import { translate } from "./i18n";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Event times are stored as "05-March: 8PM". Returns { day, month, hour }
 * (e.g. "05", "MAR", "8PM" — month and hour in the UI language),
 * or null if the text has another format.
 */
export function parseEventTime(time) {
  const match = /^(\d{1,2})-([A-Za-z]+):\s*(\d{1,2})\s*(AM|PM)$/i.exec(time || "");
  if (!match) return null;
  const monthIndex = MONTHS.findIndex((name) => name.startsWith(match[2].slice(0, 3).toLowerCase()));
  const hour12 = Number(match[3]);
  const period = match[4].toUpperCase();
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return {
    day: match[1].padStart(2, "0"),
    month:
      monthIndex === -1
        ? match[2].slice(0, 3).toUpperCase()
        : // Stored in display case: toUpperCase() would turn Georgian into Mtavruli
          translate("months.short")[monthIndex],
    // English keeps "8PM"; Georgian and Russian use 24-hour "20:00"
    hour:
      translate("format.timeStyle") === "24h"
        ? `${String(hour24).padStart(2, "0")}:00`
        : `${hour12}${period}`,
  };
}

/**
 * Readable event time: "05 MAR · 8PM", or the raw text if it can't be parsed.
 */
export function formatEventTime(time) {
  const when = parseEventTime(time);
  return when ? `${when.day} ${when.month} · ${when.hour}` : time;
}

/** "2026-10-07" → "7 October 2026" in the UI language. */
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return translate("format.date", {
    day,
    month: translate("months.inDate")[month - 1],
    year,
  });
}
