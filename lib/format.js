import { translate } from "./i18n";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const is24h = () => translate("format.timeStyle") === "24h";

/** Clock time in the UI style: "8PM" / "8:30PM" (English) or "20:00" (Georgian, Russian). */
export function formatClock(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (is24h()) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const hour12 = hours % 12 || 12;
  const period = hours < 12 ? "AM" : "PM";
  return minutes ? `${hour12}:${String(minutes).padStart(2, "0")}${period}` : `${hour12}${period}`;
}

/**
 * Event start → { day, month, hour, date } in the phone's time zone and UI language
 * (e.g. "05", "MAR", "8PM"), or null if it can't be read.
 * Accepts the real start time ("2026-03-05T16:00:00.000Z") and, for events saved
 * by older app versions, the old text format ("05-March: 8PM").
 */
export function parseEventTime(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return {
      day: String(date.getDate()).padStart(2, "0"),
      // Stored in display case: toUpperCase() would turn Georgian into Mtavruli
      month: translate("months.short")[date.getMonth()],
      hour: formatClock(date),
      date,
    };
  }

  const match = /^(\d{1,2})-([A-Za-z]+):\s*(\d{1,2})\s*(AM|PM)$/i.exec(value);
  if (!match) return null;
  const monthIndex = MONTHS.findIndex((name) => name.startsWith(match[2].slice(0, 3).toLowerCase()));
  const hour12 = Number(match[3]);
  const period = match[4].toUpperCase();
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return {
    day: match[1].padStart(2, "0"),
    month: monthIndex === -1 ? match[2].slice(0, 3).toUpperCase() : translate("months.short")[monthIndex],
    hour: is24h() ? `${String(hour24).padStart(2, "0")}:00` : `${hour12}${period}`,
    date: null,
  };
}

/** The start time of an event object (new field first, old text as fallback). */
export const eventStart = (event) => event?.starts_at || event?.time || null;

/**
 * Readable event time: "05 MAR · 8PM", plus "Today" / "Tomorrow" when it fits,
 * or the raw text if it can't be read.
 */
export function formatEventTime(value) {
  const when = parseEventTime(value);
  if (!when) return value;
  if (when.date) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(when.date, today)) return `${translate("time.today")} · ${when.hour}`;
    if (sameDay(when.date, tomorrow)) return `${translate("time.tomorrow")} · ${when.hour}`;
  }
  return `${when.day} ${when.month} · ${when.hour}`;
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

/** Time until a chat disappears: "23h left", "45m left", "Ending now". */
export function formatTimeLeft(expiresAt, now = Date.now()) {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now) / 60000);
  if (minutes <= 0) return translate("chat.endingNow");
  if (minutes < 60) return translate("chat.minutesLeft", { count: minutes });
  return translate("chat.hoursLeft", { count: Math.floor(minutes / 60) });
}
