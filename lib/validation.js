// Sign-up rules. Keep in sync with the worker (api/src/index.js), which
// enforces the same rules on the server.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 3–30 letters, numbers, dots or underscores
export const USERNAME_RE = /^[A-Za-z0-9._]{3,30}$/;

export const PASSWORD_MIN_LENGTH = 9;

// Each rule has a key for its translated label (auth.passwordRules.<key>)
export const PASSWORD_RULES = [
  { key: "length", test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", test: (value) => /[A-Z]/.test(value) },
  { key: "number", test: (value) => /[0-9]/.test(value) },
  { key: "symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export const isStrongPassword = (value) => PASSWORD_RULES.every((rule) => rule.test(value));

export const normalizeEmail = (value) => value.trim().toLowerCase();

export const MIN_AGE = 13; // whole app; Discover and chat are 18+

/** Formats typed digits as DD.MM.YYYY while typing ("0105" → "01.05"). */
export function maskBirthDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join(".");
}

/** "DD.MM.YYYY" → "YYYY-MM-DD", or null if it isn't a real date. */
export function birthDateToIso(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Age in whole years for "YYYY-MM-DD" (same calculation as the server). */
export function ageFromIso(iso, today = new Date()) {
  const [year, month, day] = iso.split("-").map(Number);
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() < month - 1 || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}
