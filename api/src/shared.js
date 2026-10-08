// Helpers used by every route file (index.js, social.js).

// ── Responses & errors ───────────────────────────

/**
 * JSON response with CORS header.
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Error with an HTTP status; thrown inside routes and turned into a JSON
 * response by the top-level handler.
 */
export class HttpError extends Error {
  // `code` is a stable id the app maps to a translated message
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function requireUser(user) {
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}

/**
 * Text from a request, limited in length. null/undefined stay null.
 * Throws a 400 "too_long" error instead of silently cutting the text.
 */
export function limitText(value, max, field) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text.length > max) {
    throw new HttpError(400, `${field} is too long (max ${max} characters)`, "too_long");
  }
  return text;
}

// ── Event times ──────────────────────────────────

// An event stays listed this long after it starts (nights run late)
export const EVENT_LISTED_HOURS = 8;

/** Oldest start time that still counts as "upcoming / happening now". */
export const upcomingCutoff = (now = Date.now()) =>
  new Date(now - EVENT_LISTED_HOURS * 3600 * 1000).toISOString();

/**
 * Validates an event start time from the app and returns it as UTC ISO.
 * Must be a real date, not already over, and at most ~2 years ahead.
 */
export function parseStartsAt(value, { allowPast = false } = {}) {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) {
    throw new HttpError(400, "Invalid start time", "invalid_starts_at");
  }
  if (!allowPast && date.toISOString() < upcomingCutoff()) {
    throw new HttpError(400, "The event is already over", "starts_at_past");
  }
  if (date.getTime() > Date.now() + 2 * 366 * 24 * 3600 * 1000) {
    throw new HttpError(400, "Start time is too far ahead", "invalid_starts_at");
  }
  return date.toISOString();
}

// ── Age ──────────────────────────────────────────

/** Age in whole years for a "YYYY-MM-DD" date, or null if it isn't a real date. */
export function ageFrom(birthDate, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof birthDate === "string" ? birthDate : "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates like 2001-02-30
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

// ── Blocks ───────────────────────────────────────

/** True if either person has blocked the other. */
export async function isBlockedEitherWay(db, a, b) {
  const row = await db
    .prepare(
      "SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
    )
    .bind(a, b, b, a)
    .first();
  return !!row;
}

// SQL condition hiding people blocked in either direction from the caller.
// Bind the caller's id twice.
export const NOT_BLOCKED_SQL = (column) => `
  ${column} NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
  AND ${column} NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)`;

// ── Complete profiles ────────────────────────────

/**
 * A personal account is "complete" with a username, first name, last name and
 * profile photo (bio is optional). Incomplete accounts can't post, chat or use
 * Discover, and nobody else can see them.
 */
export const COMPLETE_PROFILE_SQL = (alias) => `(
  COALESCE(TRIM(${alias}.username), '') != ''
  AND COALESCE(TRIM(${alias}.first_name), '') != ''
  AND COALESCE(TRIM(${alias}.last_name), '') != ''
  AND COALESCE(${alias}.profile_photo, '') != '')`;

/** Same rule for a profile row already loaded in JavaScript. */
export const isProfileComplete = (profile) =>
  !!profile &&
  !!profile.username?.trim() &&
  !!profile.first_name?.trim() &&
  !!profile.last_name?.trim() &&
  !!profile.profile_photo;

// ── Images ───────────────────────────────────────

export const IMAGE_DOMAIN = "https://night-life-api.elevator-rand.workers.dev/images";

/**
 * Stored key → full public URL (the API always returns full URLs).
 * Values that are already URLs (legacy data) are returned unchanged.
 */
export function toImageUrl(key) {
  if (!key) return null;
  return /^https?:\/\//.test(key) ? key : `${IMAGE_DOMAIN}/${key}`;
}
