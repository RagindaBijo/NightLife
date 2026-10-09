import {
  HttpError,
  IMAGE_DOMAIN,
  COMPLETE_PROFILE_SQL,
  MUSIC_GENRES,
  NOTIFICATIONS_SQL,
  NOT_BLOCKED_SQL,
  PLACE_TYPES,
  ageFrom,
  cleanPhotoRatio,
  cleanPreferences,
  followStatus,
  isBlockedEitherWay,
  notificationBinds,
  json,
  limitText,
  parseId,
  parseStartsAt,
  upcomingCutoff,
  readJson,
  requireUser,
  toImageUrl,
} from "./shared.js";
import {
  ChatRoom,
  chatStatusFor,
  cleanUpExpiredChats,
  deleteSocialDataStatements,
  endConnectionStatements,
  handleSocial,
} from "./social.js";

// Durable Object class for live chat rooms (bound as CHAT_ROOMS in wrangler.toml)
export { ChatRoom };

/**
 * Night-Life API – Cloudflare Worker
 * Handles auth (JWT), users, venues, events, posts, and image storage (R2).
 */

// ────────────────────────────────────────────────
// JWT helpers
// ────────────────────────────────────────────────

/**
 * Creates a signed JWT (HS256).
 * Token expires in 7 days.
 * @param {number|string} userId
 * @param {number} userType  – 1 = regular user, 2 = venue
 * @param {string} secret
 * @param {number} version   – login_data.token_version; raising it revokes older tokens
 * @returns {Promise<string>} JWT string
 */
async function generateToken(userId, userType, secret, version = 0) {
  // JWT header
  const header = { alg: "HS256", typ: "JWT" };

  // Payload: identity + expiry (Unix timestamp)
  const payload = {
    userId,
    userType,
    ver: version,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
  };

  // Base64url-encode header & payload (strip padding)
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=+$/, "");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=+$/, "");
  const data = `${encodedHeader}.${encodedPayload}`;

  // Import the secret as an HMAC key
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );

  // Base64url-encode the signature
  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  ).replace(/=+$/, "");

  return `${data}.${encodedSignature}`;
}

/**
 * Verifies a JWT and returns the payload if valid, otherwise null.
 * Checks signature and expiry.
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object|null>}
 */
async function verifyToken(token, secret) {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    const data = `${encodedHeader}.${encodedPayload}`;

    // Import secret for verification
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Decode signature and verify
    const signature = Uint8Array.from(atob(encodedSignature), (c) =>
      c.charCodeAt(0),
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(data),
    );

    if (!isValid) return null;

    // Parse payload and check expiry
    const payload = JSON.parse(atob(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (error) {
    return null; // Any error → treat as invalid
  }
}

// ────────────────────────────────────────────────
// Password hashing (PBKDF2-SHA256)
// ────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100000; // Maximum allowed by Workers

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function pbkdf2(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Hashes a password with a random salt.
 * @param {string} password
 * @returns {Promise<string>} "pbkdf2$<iterations>$<salt>$<hash>"
 */
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

function timingSafeEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * Checks a password against its stored PBKDF2 hash.
 * (Old plain-text passwords are no longer accepted – every account is hashed.)
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("pbkdf2$")) return false;

  const [, iterations, saltB64, hashB64] = stored.split("$");
  const expected = base64ToBytes(hashB64);
  const actual = await pbkdf2(
    password,
    base64ToBytes(saltB64),
    parseInt(iterations),
  );
  return timingSafeEqual(actual, expected);
}

// ────────────────────────────────────────────────
// Sign-up validation (the app checks the same rules while typing)
// ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 3–30 letters, numbers, dots or underscores; compared case-insensitively
const USERNAME_RE = /^[A-Za-z0-9._]{3,30}$/;

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

/** Returns the missing password rules (empty array = strong enough). */
function passwordProblems(password) {
  if (typeof password !== "string") return ["length"];
  const problems = [];
  if (password.length < 9) problems.push("length");
  if (!/[A-Z]/.test(password)) problems.push("uppercase");
  if (!/[0-9]/.test(password)) problems.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("symbol");
  return problems;
}

const MIN_AGE = 13; // the app is 13+ (Discover and chat will be 18+)

// What people can report, and why (the app shows a translated label for each)
const REPORT_REASONS = ["fake_account", "sexual_content", "other"];
const REPORT_TARGETS = ["user", "post", "venue"];

/** True if a user or venue already uses this username (any letter case). */
async function isUsernameTaken(db, username, exceptId = null) {
  const row = await db
    .prepare(
      `SELECT id FROM user_profile WHERE username = ? COLLATE NOCASE AND id IS NOT ?
       UNION ALL
       SELECT id FROM venue_profile WHERE username = ? COLLATE NOCASE AND id IS NOT ?
       LIMIT 1`,
    )
    .bind(username, exceptId, username, exceptId)
    .first();
  return !!row;
}

/**
 * Checks a username for profile updates. Throws HttpError with a code the
 * app can translate.
 */
async function checkUsername(db, username, exceptId = null) {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    throw new HttpError(400, "Invalid username", "invalid_username");
  }
  if (await isUsernameTaken(db, username, exceptId)) {
    throw new HttpError(409, "Username is already taken", "username_taken");
  }
}

// ────────────────────────────────────────────────
// Image helpers
// ────────────────────────────────────────────────

// R2 folders that belong to a given user / venue / event
const userImagePrefix = (userId) => `night-life-images/users/${userId}/`;
const venueImagePrefix = (userId) => `venues/${userId}/`;
const eventTempPrefix = (userId) => `events/temp/${userId}/`;
const eventImagePrefix = (eventId) => `events/${eventId}/`;

function isKeyIn(key, prefix) {
  return typeof key === "string" && key.startsWith(prefix);
}

/**
 * Full URL or key from a client → stored key.
 */
function toImageKey(value) {
  if (typeof value !== "string") return value;
  const prefix = `${IMAGE_DOMAIN}/`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/**
 * Comma-separated string or array → array of trimmed, non-empty strings.
 */
function splitList(value) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(",");
  return items.map((item) => String(item).trim()).filter(Boolean);
}

// Accepted upload types → stored content type + file extension
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
  "image/jpg": { contentType: "image/jpeg", extension: "jpg" }, // non-standard, sent by some clients
  "image/png": { contentType: "image/png", extension: "png" },
  "image/webp": { contentType: "image/webp", extension: "webp" },
  "image/heic": { contentType: "image/heic", extension: "heic" },
  "image/heif": { contentType: "image/heif", extension: "heif" },
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES_PER_UPLOAD = 10;

/**
 * Deletes every R2 object under a prefix.
 * @param {R2Bucket} bucket
 * @param {string} prefix
 */
async function deleteR2Prefix(bucket, prefix) {
  let cursor;
  do {
    const listed = await bucket.list({ prefix, cursor });
    const keys = listed.objects.map((object) => object.key);
    if (keys.length > 0) {
      await bucket.delete(keys);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

// ────────────────────────────────────────────────
// Venue types & ratings
// ────────────────────────────────────────────────

// Styles a venue can pick (several per venue); these keys are stored in venue_types
const VENUE_TYPES = [
  "nightclub",
  "disco",
  "techno",
  "hip_hop",
  "jazz",
  "rock",
  "live_music",
  "karaoke",
  "bar",
  "pub",
  "lounge",
  "cocktail_bar",
  "wine_bar",
  "rooftop",
  "beach_bar",
  "restaurant_bar",
];

// Extra columns for venue queries (the venue table must be aliased as v)
// Feedback categories the app can send
const FEEDBACK_CATEGORIES = ["bug", "idea", "venue", "other"];
const FEEDBACK_MAX_LENGTH = 2000;

const VENUE_EXTRAS_SQL = `
  (SELECT GROUP_CONCAT(t.type) FROM venue_types t WHERE t.venue_id = v.id) AS types,
  (SELECT ROUND(AVG(r.rating), 1) FROM venue_ratings r WHERE r.venue_id = v.id) AS rating_avg,
  (SELECT COUNT(*) FROM venue_ratings r WHERE r.venue_id = v.id) AS rating_count`;

function formatVenue(venue) {
  return {
    ...venue,
    photo_ids: splitList(venue.photo_ids).map(toImageUrl),
    types: splitList(venue.types),
    rating_avg: venue.rating_avg ?? null,
    rating_count: venue.rating_count ?? 0,
    is_favorite: !!venue.is_favorite,
  };
}

// ────────────────────────────────────────────────
// Main Worker entry point
// ────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const { pathname, searchParams } = new URL(request.url);
    const method = request.method;

    // Secrets / config
    const JWT_SECRET = env.JWT_SECRET;

    // ── CORS pre-flight ──────────────────────────
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Refuse to run without a real secret – never fall back to a guessable one
    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return json({ error: "Server misconfigured" }, 500);
    }

    // ── Extract & verify JWT (if present) ────────
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    let user = token ? await verifyToken(token, JWT_SECRET) : null;
    // `user` is either the decoded payload { userId, userType, ver, exp } or null

    // Revocation: the account must still exist and the token must carry its
    // current version (raised on password change). Older tokens have no
    // version and count as 0.
    if (user) {
      const account = await env.DB.prepare(
        "SELECT token_version FROM login_data WHERE id = ?",
      )
        .bind(user.userId)
        .first();
      if (!account || account.token_version !== (user.ver ?? 0)) user = null;
    }

    // Rate limiting: too many requests in a minute → 429 "rate_limited".
    // Skipped if the binding isn't configured (e.g. an older local setup).
    const clientIp = request.headers.get("CF-Connecting-IP") || "local";
    const rateLimit = async (limiter, key) => {
      if (!limiter) return;
      const { success } = await limiter.limit({ key });
      if (!success) throw new HttpError(429, "Too many requests, slow down", "rate_limited");
    };

    // Exact route matching: returns the regex match for this method + path, or null
    const route = (routeMethod, pattern) =>
      method === routeMethod ? pathname.match(pattern) : null;
    // PUT = add, DELETE = remove (likes, favorites, interests, follows)
    const toggleRoute = (pattern) =>
      method === "PUT" || method === "DELETE" ? pathname.match(pattern) : null;

    try {
      let match;

      // ════════════════════════════════════════════
      // IMAGE ROUTES (R2)
      // ════════════════════════════════════════════

      // GET /images/:key  – Serve an image from R2
      if ((match = route("GET", /^\/images\/(.+)$/))) {
        const object = await env.R2.get(match[1]);
        if (!object) return json({ error: "Image not found" }, 404);

        return new Response(object.body, {
          status: 200,
          headers: {
            "Content-Type": object.httpMetadata.contentType || "image/jpeg",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=31536000", // 1 year
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      // DELETE /api/delete-image/:key  – Delete image (owner only)
      if ((match = route("DELETE", /^\/api\/delete-image\/(.+)$/))) {
        requireUser(user);
        const key = toImageKey(match[1]);

        // Only allow deleting images in the caller's own folders
        let ownsKey =
          isKeyIn(key, userImagePrefix(user.userId)) ||
          isKeyIn(key, venueImagePrefix(user.userId)) ||
          isKeyIn(key, eventTempPrefix(user.userId));

        // Event images: only if the event belongs to this venue
        const eventMatch = key.match(/^events\/(\d+)\//);
        if (!ownsKey && eventMatch && user.userType === 2) {
          const event = await env.DB.prepare(
            "SELECT venue_id FROM events WHERE id = ?",
          )
            .bind(parseInt(eventMatch[1]))
            .first();
          ownsKey = !!event && Number(event.venue_id) === user.userId;
        }

        if (!ownsKey)
          return json({ error: "Unauthorized: Cannot delete image" }, 403);

        const object = await env.R2.head(key);
        if (!object) return json({ error: "Image not found" }, 404);

        await env.R2.delete(key);
        return json({ success: true, message: "Image deleted successfully" });
      }

      // POST /api/upload-image  – Upload one or more images to R2
      // Query params: ?type=user|venue|event  &eventId=...
      if (route("POST", /^\/api\/upload-image$/)) {
        requireUser(user);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);

        const formData = await request.formData();
        const files = formData.getAll("file");

        if (files.length === 0)
          return json({ error: "No files uploaded" }, 400);
        if (files.length > MAX_FILES_PER_UPLOAD) {
          return json(
            { error: `Too many files (max ${MAX_FILES_PER_UPLOAD})` },
            400,
          );
        }

        // Validate every file before storing anything
        for (const file of files) {
          if (typeof file === "string" || !ALLOWED_IMAGE_TYPES[file.type]) {
            return json(
              { error: "Only JPEG, PNG, WebP or HEIC images are allowed" },
              400,
            );
          }
          if (file.size > MAX_IMAGE_BYTES) {
            return json({ error: "Image is too large (max 10 MB)" }, 400);
          }
        }

        const type = searchParams.get("type") || "user";
        const eventIdParam = searchParams.get("eventId");

        if (!["user", "venue", "event"].includes(type)) {
          return json({ error: "Invalid upload type" }, 400);
        }

        // Venue and event images can only be uploaded by venues
        if ((type === "venue" || type === "event") && user.userType !== 2) {
          return json({ error: "Only venues can upload this image type" }, 403);
        }

        // Uploading to an existing event requires owning that event
        let eventId = null;
        if (type === "event" && eventIdParam) {
          eventId = parseId(eventIdParam);
          const event = await env.DB.prepare(
            "SELECT venue_id FROM events WHERE id = ?",
          )
            .bind(eventId)
            .first();

          if (!event || Number(event.venue_id) !== user.userId) {
            return json({ error: "Event not found or unauthorized" }, 403);
          }
        }

        // Decide storage folder based on type
        let folder;
        if (type === "event") {
          folder = eventId
            ? eventImagePrefix(eventId)
            : eventTempPrefix(user.userId);
        } else if (type === "venue") {
          folder = venueImagePrefix(user.userId);
        } else {
          folder = userImagePrefix(user.userId);
        }

        const keys = [];
        const urls = [];

        for (const file of files) {
          const { contentType, extension } = ALLOWED_IMAGE_TYPES[file.type];
          const key = `${folder}${crypto.randomUUID()}.${extension}`;

          await env.R2.put(key, await file.arrayBuffer(), {
            httpMetadata: { contentType },
          });

          keys.push(key);
          urls.push(toImageUrl(key));
        }

        // `key` / `url` (first file) are what single-image screens read
        return json({ keys, urls, key: keys[0], url: urls[0] });
      }

      // ════════════════════════════════════════════
      // AUTH ROUTES
      // ════════════════════════════════════════════

      // GET /api/username-available?username=…  – Live check while signing up
      if (route("GET", /^\/api\/username-available$/)) {
        await rateLimit(env.SEARCH_LIMITER, `search:${clientIp}`);
        const username = (searchParams.get("username") || "").trim();
        if (!USERNAME_RE.test(username)) {
          return json({ available: false, reason: "invalid_username" });
        }
        const taken = await isUsernameTaken(env.DB, username);
        return json({ available: !taken, reason: taken ? "username_taken" : null });
      }

      // POST /api/register  – Create account + profile in one step
      // Body: { email, password, user_type, username, accepted_terms,
      //         first_name, last_name, birth_date "YYYY-MM-DD" (users) | title (venues) }
      if (route("POST", /^\/api\/register$/)) {
        await rateLimit(env.AUTH_LIMITER, `auth:${clientIp}`);
        const body = await readJson(request);
        const userType = body.user_type;
        const email = normalizeEmail(body.email);
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const text = (value, max) =>
          typeof value === "string" ? value.trim().slice(0, max) : "";
        const firstName = text(body.first_name, 50);
        const lastName = text(body.last_name, 50);
        const title = text(body.title, 80);

        if (userType !== 1 && userType !== 2) {
          throw new HttpError(400, "Invalid user type", "invalid_user_type");
        }
        if (body.accepted_terms !== true) {
          throw new HttpError(400, "You must accept the Terms of Use", "terms_required");
        }
        if (!EMAIL_RE.test(email) || email.length > 254) {
          throw new HttpError(400, "Invalid email", "invalid_email");
        }
        if (passwordProblems(body.password).length > 0) {
          throw new HttpError(400, "Password is too weak", "weak_password");
        }
        if (userType === 1 && (!firstName || !lastName)) {
          throw new HttpError(400, "Missing required fields", "missing_fields");
        }
        // Personal accounts give their date of birth (needed for 18+ features)
        let birthDate = null;
        if (userType === 1) {
          const age = ageFrom(body.birth_date);
          if (age === null || age > 120) {
            throw new HttpError(400, "Invalid date of birth", "invalid_birth_date");
          }
          if (age < MIN_AGE) {
            throw new HttpError(400, `You must be at least ${MIN_AGE}`, "too_young");
          }
          birthDate = body.birth_date;
        }
        if (userType === 2 && !title) {
          throw new HttpError(400, "Missing required fields", "missing_fields");
        }
        await checkUsername(env.DB, username);

        const emailTaken = await env.DB.prepare(
          "SELECT id FROM login_data WHERE lower(email) = ?",
        )
          .bind(email)
          .first();
        if (emailTaken) {
          throw new HttpError(409, "Email already exists", "email_taken");
        }

        // One transaction: the login row (its profile row is created by a DB
        // trigger) and the profile details. If any part fails, nothing is saved.
        const now = new Date().toISOString();
        const passwordHash = await hashPassword(body.password);
        const profileUpdate =
          userType === 1
            ? env.DB.prepare(
                `UPDATE user_profile SET username = ?, first_name = ?, last_name = ?, update_date = ?
                 WHERE id = (SELECT id FROM login_data WHERE email = ?)`,
              ).bind(username, firstName, lastName, now, email)
            : env.DB.prepare(
                `UPDATE venue_profile SET username = ?, title = ?, update_date = ?
                 WHERE id = (SELECT id FROM login_data WHERE email = ?)`,
              ).bind(username, title, now, email);

        let inserted;
        try {
          [inserted] = await env.DB.batch([
            env.DB.prepare(
              `INSERT INTO login_data (email, password, user_type, create_date, terms_accepted_at, birth_date)
               VALUES (?, ?, ?, ?, ?, ?)`,
            ).bind(email, passwordHash, userType, now, now, birthDate),
            profileUpdate,
          ]);
        } catch (err) {
          // Two sign-ups racing for the same email / username hit the unique indexes
          if (/UNIQUE/i.test(String(err?.message))) {
            const code = /email/i.test(err.message) ? "email_taken" : "username_taken";
            throw new HttpError(409, "Already taken", code);
          }
          throw err;
        }

        const userId = inserted.meta.last_row_id;
        const token = await generateToken(userId, userType, JWT_SECRET);

        return json({ token, userId, userType });
      }

      // POST /api/login  – Authenticate and return JWT
      if (route("POST", /^\/api\/login$/)) {
        await rateLimit(env.AUTH_LIMITER, `auth:${clientIp}`);
        const body = await readJson(request);
        const email = normalizeEmail(body.email);
        const password = body.password;

        if (!email || !password) {
          return json({ error: "Missing required fields" }, 400);
        }

        // Emails are stored lower-case now; lower() also matches older accounts
        const account = await env.DB.prepare(
          "SELECT id, password, user_type, token_version FROM login_data WHERE lower(email) = ?",
        )
          .bind(email)
          .first();

        if (!account || !(await verifyPassword(password, account.password))) {
          return json({ error: "Invalid credentials" }, 401);
        }

        const token = await generateToken(
          account.id,
          account.user_type,
          JWT_SECRET,
          account.token_version,
        );

        return json({ token, userId: account.id, userType: account.user_type });
      }

      // GET /api/login/:id  – Get own login record (no password)
      if ((match = route("GET", /^\/api\/login\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        // Login records (email etc.) are private – only the owner may read them
        if (id !== user.userId) return json({ error: "Forbidden" }, 403);

        const record = await env.DB.prepare(
          "SELECT id, email, user_type, last_active, create_date, update_date FROM login_data WHERE id = ?",
        )
          .bind(id)
          .first();

        return record ? json(record) : json({ error: "Not found" }, 404);
      }

      // PUT /api/login/:id  – Update own password / last_active
      // Body: { password, current_password } or { last_active }
      if ((match = route("PUT", /^\/api\/login\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        // Only the owner may change their own login record
        if (id !== user.userId) return json({ error: "Forbidden" }, 403);

        const { password, current_password, last_active } = await readJson(request);

        const updates = [];
        const values = [];

        if (password) {
          // A stolen token alone must not be enough to take over the account
          const account = await env.DB.prepare(
            "SELECT password FROM login_data WHERE id = ?",
          )
            .bind(id)
            .first();
          if (!account || !(await verifyPassword(current_password ?? "", account.password))) {
            throw new HttpError(403, "Current password is wrong", "wrong_password");
          }
          if (passwordProblems(password).length > 0) {
            throw new HttpError(400, "Password is too weak", "weak_password");
          }
          updates.push("password = ?");
          values.push(await hashPassword(password));
          // Log out every other device
          updates.push("token_version = token_version + 1");
        }
        if (last_active) {
          updates.push("last_active = ?");
          values.push(last_active);
        }

        if (updates.length === 0)
          return json({ error: "No fields to update" }, 400);

        values.push(new Date().toISOString(), id);

        await env.DB.prepare(
          `UPDATE login_data SET ${updates.join(", ")}, update_date = ? WHERE id = ?`,
        )
          .bind(...values)
          .run();

        if (password) {
          // A fresh token so this device stays logged in
          const { token_version } = await env.DB.prepare(
            "SELECT token_version FROM login_data WHERE id = ?",
          )
            .bind(id)
            .first();
          const token = await generateToken(id, user.userType, JWT_SECRET, token_version);
          return json({ success: true, token });
        }
        return json({ success: true });
      }

      // ════════════════════════════════════════════
      // USER ROUTES
      // ════════════════════════════════════════════

      // GET /api/user/:id  – User profile (private lists only for the owner)
      if ((match = route("GET", /^\/api\/user\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        // Explicit columns – never return email or password
        const profile = await env.DB.prepare(
          `SELECT id, username, user_type, first_name, last_name, profile_photo,
                  ticket_ids, bio_text, is_hidden, create_date, update_date,
                  ${COMPLETE_PROFILE_SQL("user_profile")} AS complete,
                  (SELECT GROUP_CONCAT(genre) FROM user_music WHERE user_id = user_profile.id) AS music,
                  (SELECT GROUP_CONCAT(type) FROM user_venue_types WHERE user_id = user_profile.id) AS venue_types
           FROM user_profile WHERE id = ?`,
        )
          .bind(id)
          .first();

        if (!profile) return json({ error: "Not found" }, 404);
        // Until photo, names and username are set, nobody else can see the profile
        if (id !== user.userId && !profile.complete) {
          return json({ error: "Not found" }, 404);
        }

        // Someone who blocked you looks like they don't exist
        const block = await env.DB.prepare(
          `SELECT
             EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?) AS blocked_by_me,
             EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?) AS blocked_me`,
        )
          .bind(user.userId, id, id, user.userId)
          .first();
        if (block.blocked_me) return json({ error: "Not found" }, 404);

        const counts = await env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
             (SELECT COUNT(*) FROM follows WHERE follower_id = ?)  AS following_count,
             (SELECT COUNT(*) FROM posts   WHERE user_id = ?)      AS posts_count,
             EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS is_following,
             EXISTS (SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?) AS is_requested,
             EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS follows_you,
             EXISTS (SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?) AS requested_you`,
        )
          .bind(id, id, id, user.userId, id, user.userId, id, id, user.userId, id, user.userId)
          .first();

        const { ticket_ids, is_hidden, complete, music, venue_types, ...publicProfile } = profile;
        const result = {
          ...publicProfile,
          profile_photo: toImageUrl(profile.profile_photo),
          followers_count: counts.followers_count,
          following_count: counts.following_count,
          posts_count: counts.posts_count,
          is_following: !!counts.is_following,
          // "following" | "requested" (waiting for them to accept) | "none"
          follow_status: followStatus(counts.is_following, counts.is_requested),
          follows_you: !!counts.follows_you, // → "Follow back"
          requested_you: !!counts.requested_you, // they asked to follow you
          is_blocked: !!block.blocked_by_me,
          music: splitList(music),
          venue_types: splitList(venue_types),
        };

        // Favorites, interests and tickets are private
        if (id === user.userId) {
          const [favorites, interests] = await env.DB.batch([
            env.DB.prepare(
              "SELECT venue_id FROM venue_favorites WHERE user_id = ?",
            ).bind(id),
            env.DB.prepare(
              "SELECT event_id FROM event_interests WHERE user_id = ?",
            ).bind(id),
          ]);
          result.favorite_ids = favorites.results.map((row) => row.venue_id);
          result.interested_ids = interests.results.map((row) => row.event_id);
          result.ticket_ids = splitList(ticket_ids);
          result.is_hidden = !!is_hidden;
          result.profile_complete = !!complete;
        } else {
          Object.assign(result, await chatStatusFor(env.DB, user.userId, id));
        }

        return json(result);
      }

      // PUT /api/user/:id  – Update own user profile (regular users only)
      if ((match = route("PUT", /^\/api\/user\/([^/]+)$/))) {
        requireUser(user);
        const userId = parseId(match[1]);

        // Must be the owner and a regular user (type 1)
        if (user.userId !== userId || user.userType !== 1) {
          return json({ error: "Forbidden" }, 403);
        }

        const body = await readJson(request);

        // Build dynamic UPDATE statement from provided fields.
        // Follows / favorites / interests have their own endpoints.
        const updates = [];
        const values = [];

        // Image key must point to the user's own folder (or be empty to clear)
        if ("profile_photo" in body) {
          const profilePhoto = toImageKey(body.profile_photo);
          if (profilePhoto && !isKeyIn(profilePhoto, userImagePrefix(userId))) {
            return json({ error: "Invalid profile_photo" }, 400);
          }
          updates.push("profile_photo = ?");
          values.push(profilePhoto || null);
        }

        if ("username" in body) {
          const username = String(body.username ?? "").trim();
          await checkUsername(env.DB, username, userId); // unique, valid format
          updates.push("username = ?");
          values.push(username);
        }
        if ("first_name" in body) {
          updates.push("first_name = ?");
          values.push(limitText(body.first_name, 50, "first_name"));
        }
        if ("last_name" in body) {
          updates.push("last_name = ?");
          values.push(limitText(body.last_name, 50, "last_name"));
        }
        if ("ticket_ids" in body) {
          updates.push("ticket_ids = ?");
          values.push(body.ticket_ids);
        }
        if ("bio_text" in body) {
          updates.push("bio_text = ?");
          values.push(limitText(body.bio_text, 300, "bio_text"));
        }
        // Music styles and kinds of places (3–10 each), saved below in one batch
        const music = "music" in body ? cleanPreferences(body.music, MUSIC_GENRES, "music") : null;
        const venueTypes =
          "venue_types" in body ? cleanPreferences(body.venue_types, PLACE_TYPES, "venue types") : null;

        // Hidden = not shown in Discover or people search
        if ("is_hidden" in body) {
          if (typeof body.is_hidden !== "boolean") {
            return json({ error: "is_hidden must be true or false" }, 400);
          }
          updates.push("is_hidden = ?");
          values.push(body.is_hidden ? 1 : 0);
        }

        if (updates.length === 0 && !music && !venueTypes)
          return json({ error: "No fields to update" }, 400);

        values.push(new Date().toISOString(), userId); // update_date + WHERE id

        const [result] = await env.DB.batch([
          env.DB.prepare(
            `UPDATE user_profile SET ${[...updates, "update_date = ?"].join(", ")} WHERE id = ?`,
          ).bind(...values),
          ...(music
            ? [
                env.DB.prepare("DELETE FROM user_music WHERE user_id = ?").bind(userId),
                ...music.map((genre) =>
                  env.DB.prepare("INSERT INTO user_music (user_id, genre) VALUES (?, ?)").bind(userId, genre),
                ),
              ]
            : []),
          ...(venueTypes
            ? [
                env.DB.prepare("DELETE FROM user_venue_types WHERE user_id = ?").bind(userId),
                ...venueTypes.map((type) =>
                  env.DB.prepare("INSERT INTO user_venue_types (user_id, type) VALUES (?, ?)").bind(userId, type),
                ),
              ]
            : []),
        ]);

        if (result.meta.changes === 0)
          return json({ error: "User profile not found" }, 404);

        return json({ success: true, message: "User profile updated" });
      }

      // DELETE /api/user/:id  – Delete own account (user or venue)
      if ((match = route("DELETE", /^\/api\/user\/([^/]+)$/))) {
        requireUser(user);
        const userId = parseId(match[1]);

        // Can only delete yourself
        if (user.userId !== userId) {
          return json(
            { error: "Unauthorized: Cannot delete another user's account" },
            403,
          );
        }

        const account = await env.DB.prepare(
          "SELECT id FROM login_data WHERE id = ?",
        )
          .bind(userId)
          .first();

        if (!account) return json({ error: "User not found" }, 404);

        // Collect the venue's events so their image folders can be removed too
        const { results: ownedEvents } = await env.DB.prepare(
          "SELECT id FROM events WHERE venue_id = ?",
        )
          .bind(userId)
          .all();

        // Remove all of the account's rows in one transaction
        await env.DB.batch([
          env.DB.prepare(
            "DELETE FROM post_likes WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM event_interests WHERE user_id = ? OR event_id IN (SELECT id FROM events WHERE venue_id = ?)",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM venue_favorites WHERE user_id = ? OR venue_id = ?",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM venue_views WHERE viewer_id = ? OR venue_id = ?",
          ).bind(userId, userId),
          env.DB.prepare("DELETE FROM user_music WHERE user_id = ?").bind(userId),
          env.DB.prepare("DELETE FROM user_venue_types WHERE user_id = ?").bind(userId),
          env.DB.prepare(
            "DELETE FROM follows WHERE follower_id = ? OR following_id = ?",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM follow_requests WHERE requester_id = ? OR target_id = ?",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM venue_ratings WHERE user_id = ? OR venue_id = ?",
          ).bind(userId, userId),
          env.DB.prepare("DELETE FROM venue_types WHERE venue_id = ?").bind(
            userId,
          ),
          // Feedback and reports are kept, just no longer linked to the account
          env.DB.prepare(
            "UPDATE feedback SET user_id = NULL WHERE user_id = ?",
          ).bind(userId),
          env.DB.prepare(
            "UPDATE reports SET reporter_id = NULL WHERE reporter_id = ?",
          ).bind(userId),
          env.DB.prepare(
            "DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?",
          ).bind(userId, userId),
          ...deleteSocialDataStatements(env.DB, userId),
          env.DB.prepare("DELETE FROM posts WHERE user_id = ?").bind(userId),
          env.DB.prepare("DELETE FROM events WHERE venue_id = ?").bind(userId),
          env.DB.prepare("DELETE FROM user_profile WHERE id = ?").bind(userId),
          env.DB.prepare("DELETE FROM venue_profile WHERE id = ?").bind(userId),
          env.DB.prepare("DELETE FROM login_data WHERE id = ?").bind(userId),
        ]);

        // Remove the account's images (best effort – the account is already gone)
        try {
          const prefixes = [
            userImagePrefix(userId),
            venueImagePrefix(userId),
            eventTempPrefix(userId),
            ...ownedEvents.map((event) => eventImagePrefix(event.id)),
          ];
          for (const prefix of prefixes) {
            await deleteR2Prefix(env.R2, prefix);
          }
        } catch (err) {
          console.error("Delete account images error:", err);
        }

        return json({ success: true, message: "Account deleted successfully" });
      }

      // GET /api/users/search?q=…  – Find people by username or name (2+ characters)
      if (route("GET", /^\/api\/users\/search$/)) {
        requireUser(user);
        await rateLimit(env.SEARCH_LIMITER, `search:${user.userId}`);
        const query = (searchParams.get("q") || "").trim().slice(0, 50);
        if (query.length < 2) return json([]);

        // Escape LIKE wildcards so "%" or "_" are matched literally
        const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const prefix = `${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const { results } = await env.DB.prepare(
          `SELECT up.id, up.username, up.first_name, up.last_name, up.profile_photo,
                  EXISTS (SELECT 1 FROM follows f
                          WHERE f.follower_id = ? AND f.following_id = up.id) AS is_following
           FROM user_profile up
           WHERE up.id != ?
             AND up.username IS NOT NULL
             AND up.is_hidden = 0
             AND ${COMPLETE_PROFILE_SQL("up")}
             AND ${NOT_BLOCKED_SQL("up.id")}
             AND (up.username LIKE ? ESCAPE '\\'
                  OR up.first_name LIKE ? ESCAPE '\\'
                  OR up.last_name LIKE ? ESCAPE '\\'
                  OR (up.first_name || ' ' || up.last_name) LIKE ? ESCAPE '\\')
           -- Usernames starting with the query first, then alphabetical
           ORDER BY (up.username LIKE ? ESCAPE '\\') DESC, up.username COLLATE NOCASE
           LIMIT 20`,
        )
          .bind(user.userId, user.userId, user.userId, user.userId, like, like, like, like, prefix)
          .all();

        return json(
          results.map((row) => ({
            ...row,
            profile_photo: toImageUrl(row.profile_photo),
            is_following: !!row.is_following,
          })),
        );
      }

      // PUT / DELETE /api/users/:id/block  – Block / unblock someone
      // Blocking also removes follows in both directions.
      if ((match = toggleRoute(/^\/api\/users\/([^/]+)\/block$/))) {
        requireUser(user);
        const targetId = parseId(match[1]);
        if (targetId === user.userId) {
          return json({ error: "You cannot block yourself" }, 400);
        }
        const target = await env.DB.prepare("SELECT id FROM login_data WHERE id = ?")
          .bind(targetId)
          .first();
        if (!target) return json({ error: "User not found" }, 404);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);

        if (method === "PUT") {
          await env.DB.batch([
            env.DB.prepare(
              "INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)",
            ).bind(user.userId, targetId),
            env.DB.prepare(
              "DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)",
            ).bind(user.userId, targetId, targetId, user.userId),
            env.DB.prepare(
              "DELETE FROM follow_requests WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)",
            ).bind(user.userId, targetId, targetId, user.userId),
            ...endConnectionStatements(env.DB, user.userId, targetId),
          ]);
        } else {
          await env.DB.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?")
            .bind(user.userId, targetId)
            .run();
        }
        return json({ is_blocked: method === "PUT" });
      }

      // GET /api/blocks  – People you have blocked (to unblock them in Settings)
      if (route("GET", /^\/api\/blocks$/)) {
        requireUser(user);
        const { results } = await env.DB.prepare(
          `SELECT b.blocked_id AS id,
                  COALESCE(up.username, vp.username) AS username,
                  up.first_name, up.last_name,
                  COALESCE(up.profile_photo, NULL) AS profile_photo,
                  b.create_date
           FROM blocks b
           LEFT JOIN user_profile up ON up.id = b.blocked_id
           LEFT JOIN venue_profile vp ON vp.id = b.blocked_id
           WHERE b.blocker_id = ?
           ORDER BY b.create_date DESC`,
        )
          .bind(user.userId)
          .all();
        return json(results.map((row) => ({ ...row, profile_photo: toImageUrl(row.profile_photo) })));
      }

      // POST /api/reports  – Report a user, post or venue
      // Body: { target_type: "user"|"post"|"venue", target_id, reason, details? }
      if (route("POST", /^\/api\/reports$/)) {
        requireUser(user);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);
        const body = await readJson(request);
        const targetType = body.target_type;
        const targetId = parseId(body.target_id);
        if (!REPORT_TARGETS.includes(targetType)) {
          return json({ error: "Invalid target_type" }, 400);
        }
        if (!REPORT_REASONS.includes(body.reason)) {
          throw new HttpError(400, "Invalid reason", "invalid_reason");
        }
        const details = limitText(
          typeof body.details === "string" ? body.details.trim() : "",
          500,
          "details",
        );

        // The target must exist, and you can't report yourself or your own post
        const target =
          targetType === "post"
            ? await env.DB.prepare("SELECT user_id AS owner FROM posts WHERE id = ?").bind(targetId).first()
            : await env.DB.prepare("SELECT id AS owner FROM login_data WHERE id = ? AND user_type = ?")
                .bind(targetId, targetType === "venue" ? 2 : 1)
                .first();
        if (!target) return json({ error: "Not found" }, 404);
        if (target.owner === user.userId) {
          return json({ error: "You cannot report yourself" }, 400);
        }

        // Reporting the same thing twice just keeps the first report
        await env.DB.prepare(
          `INSERT OR IGNORE INTO reports (reporter_id, target_type, target_id, reason, details)
           VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(user.userId, targetType, targetId, body.reason, details || null)
          .run();
        return json({ success: true }, 201);
      }

      // GET /api/users/:id/followers  – People following this account
      // GET /api/users/:id/following  – People this account follows
      // Newest first. People blocked either way (with the caller) are left out.
      if ((match = route("GET", /^\/api\/users\/([^/]+)\/(followers|following)$/))) {
        requireUser(user);
        const targetId = parseId(match[1]);
        if (targetId !== user.userId && (await isBlockedEitherWay(env.DB, user.userId, targetId))) {
          return json({ error: "Not found" }, 404);
        }
        // followers: rows where the account is followed; following: where it follows
        const [matchColumn, personColumn] =
          match[2] === "followers" ? ["following_id", "follower_id"] : ["follower_id", "following_id"];

        const { results } = await env.DB.prepare(
          `SELECT f.${personColumn} AS id,
                  ld.user_type,
                  COALESCE(up.username, vp.username) AS username,
                  COALESCE(up.first_name, vp.title) AS first_name,
                  up.last_name,
                  up.profile_photo,
                  EXISTS (SELECT 1 FROM follows mine
                          WHERE mine.follower_id = ? AND mine.following_id = f.${personColumn}) AS is_following,
                  EXISTS (SELECT 1 FROM follow_requests r
                          WHERE r.requester_id = ? AND r.target_id = f.${personColumn}) AS is_requested,
                  EXISTS (SELECT 1 FROM follows back
                          WHERE back.follower_id = f.${personColumn} AND back.following_id = ?) AS follows_you
           FROM follows f
           JOIN login_data ld ON ld.id = f.${personColumn}
           LEFT JOIN user_profile up ON up.id = f.${personColumn}
           LEFT JOIN venue_profile vp ON vp.id = f.${personColumn}
           WHERE f.${matchColumn} = ?
             AND ${NOT_BLOCKED_SQL(`f.${personColumn}`)}
             AND (vp.id IS NOT NULL OR ${COMPLETE_PROFILE_SQL("up")})
           ORDER BY f.create_date DESC, f.rowid DESC
           LIMIT 500`,
        )
          .bind(user.userId, user.userId, user.userId, targetId, user.userId, user.userId)
          .all();

        return json(
          results.map(({ is_requested, ...row }) => ({
            ...row,
            profile_photo: toImageUrl(row.profile_photo),
            is_following: !!row.is_following,
            follow_status: followStatus(row.is_following, is_requested),
            follows_you: !!row.follows_you,
            is_me: row.id === user.userId,
          })),
        );
      }

      // PUT /api/users/:id/follow  – Follow. A personal account has to accept first
      //   (a request), except when they already follow you ("Follow back"). Venues
      //   are followed straight away.
      // DELETE /api/users/:id/follow – Unfollow, or take back a waiting request
      // Answer: { status: "following"|"requested"|"none", following, followers_count }
      if ((match = toggleRoute(/^\/api\/users\/([^/]+)\/follow$/))) {
        requireUser(user);
        const targetId = parseId(match[1]);

        if (targetId === user.userId)
          return json({ error: "You cannot follow yourself" }, 400);

        const target = await env.DB.prepare(
          `SELECT ld.user_type,
                  EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS follows_me
           FROM login_data ld WHERE ld.id = ?`,
        )
          .bind(targetId, user.userId, targetId)
          .first();

        if (!target) return json({ error: "User not found" }, 404);

        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);
        if (method === "PUT" && (await isBlockedEitherWay(env.DB, user.userId, targetId))) {
          throw new HttpError(403, "You can't follow this account", "blocked");
        }

        let status = "none";
        if (method === "PUT") {
          const already = await env.DB.prepare(
            "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
          )
            .bind(user.userId, targetId)
            .first();
          if (already || target.user_type === 2 || target.follows_me) {
            await env.DB.batch([
              env.DB.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)").bind(
                user.userId,
                targetId,
              ),
              env.DB.prepare("DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?").bind(
                user.userId,
                targetId,
              ),
            ]);
            status = "following";
          } else {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO follow_requests (requester_id, target_id) VALUES (?, ?)",
            )
              .bind(user.userId, targetId)
              .run();
            status = "requested";
          }
        } else {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").bind(
              user.userId,
              targetId,
            ),
            env.DB.prepare("DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?").bind(
              user.userId,
              targetId,
            ),
          ]);
        }

        const { followers_count } = await env.DB.prepare(
          "SELECT COUNT(*) AS followers_count FROM follows WHERE following_id = ?",
        )
          .bind(targetId)
          .first();

        return json({ status, following: status === "following", followers_count });
      }

      // PUT /api/follow-requests/:userId  { accept }  – Accept or decline someone's
      // request to follow you. Answer: { accepted, followers_count, mutual }
      if ((match = route("PUT", /^\/api\/follow-requests\/([^/]+)$/))) {
        requireUser(user);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);
        const requesterId = parseId(match[1]);
        const body = await readJson(request);
        const pending = await env.DB.prepare(
          "SELECT 1 FROM follow_requests WHERE requester_id = ? AND target_id = ?",
        )
          .bind(requesterId, user.userId)
          .first();
        if (!pending) throw new HttpError(404, "Request not found", "request_not_found");

        const accept = body.accept === true;
        await env.DB.batch([
          ...(accept
            ? [
                env.DB.prepare(
                  "INSERT OR IGNORE INTO follows (follower_id, following_id, via_request) VALUES (?, ?, 1)",
                ).bind(requesterId, user.userId),
              ]
            : []),
          env.DB.prepare("DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?").bind(
            requesterId,
            user.userId,
          ),
        ]);

        const row = await env.DB.prepare(
          `SELECT (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
                  EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS i_follow`,
        )
          .bind(user.userId, user.userId, requesterId)
          .first();
        return json({ accepted: accept, followers_count: row.followers_count, mutual: accept && !!row.i_follow });
      }

      // GET /api/notifications  – Newest first: follow requests, new followers,
      // accepted requests and likes on your posts (last 100).
      // Answer: { items: [{ type, date, user, post_id?, post_image?, is_following, unread }], unread }
      if (route("GET", /^\/api\/notifications$/)) {
        requireUser(user);
        const me = await env.DB.prepare("SELECT notifications_seen_at FROM login_data WHERE id = ?")
          .bind(user.userId)
          .first();
        const { results } = await env.DB.prepare(
          `${NOTIFICATIONS_SQL}
           SELECT n.type, n.date, n.post_id, n.post_image, n.user_id,
                  ld.user_type,
                  COALESCE(up.username, vp.username) AS username,
                  COALESCE(up.first_name, vp.title) AS first_name,
                  up.profile_photo,
                  EXISTS (SELECT 1 FROM follows mine WHERE mine.follower_id = ? AND mine.following_id = n.user_id) AS is_following,
                  EXISTS (SELECT 1 FROM follow_requests r WHERE r.requester_id = ? AND r.target_id = n.user_id) AS is_requested
           FROM n
           JOIN login_data ld ON ld.id = n.user_id
           LEFT JOIN user_profile up ON up.id = n.user_id
           LEFT JOIN venue_profile vp ON vp.id = n.user_id
           WHERE ${NOT_BLOCKED_SQL("n.user_id")}
             AND (vp.id IS NOT NULL OR ${COMPLETE_PROFILE_SQL("up")})
           ORDER BY n.date DESC
           LIMIT 100`,
        )
          .bind(...notificationBinds(user.userId), user.userId, user.userId, user.userId, user.userId)
          .all();

        const seen = me?.notifications_seen_at;
        const items = results.map((row) => ({
          type: row.type,
          date: row.date,
          post_id: row.post_id ?? undefined,
          post_image: toImageUrl(row.post_image) || undefined,
          user: {
            id: row.user_id,
            user_type: row.user_type,
            username: row.username,
            first_name: row.first_name,
            profile_photo: toImageUrl(row.profile_photo),
          },
          is_following: !!row.is_following,
          follow_status: followStatus(row.is_following, row.is_requested),
          unread: !seen || row.date > seen,
        }));
        return json({ items, unread: items.filter((item) => item.unread).length });
      }

      // GET /api/notifications/unread  – { count } for the bell's badge
      if (route("GET", /^\/api\/notifications\/unread$/)) {
        requireUser(user);
        const row = await env.DB.prepare(
          `${NOTIFICATIONS_SQL}
           SELECT COUNT(*) AS count
           FROM n
           JOIN login_data ld ON ld.id = n.user_id
           LEFT JOIN user_profile up ON up.id = n.user_id
           LEFT JOIN venue_profile vp ON vp.id = n.user_id
           WHERE ${NOT_BLOCKED_SQL("n.user_id")}
             AND (vp.id IS NOT NULL OR ${COMPLETE_PROFILE_SQL("up")})
             AND n.date > COALESCE((SELECT notifications_seen_at FROM login_data WHERE id = ?), '')`,
        )
          .bind(...notificationBinds(user.userId), user.userId, user.userId, user.userId)
          .first();
        return json({ count: row.count });
      }

      // PUT /api/notifications/seen  – Everything up to now counts as read
      if (route("PUT", /^\/api\/notifications\/seen$/)) {
        requireUser(user);
        await env.DB.prepare("UPDATE login_data SET notifications_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(user.userId)
          .run();
        return json({ success: true });
      }

      // ════════════════════════════════════════════
      // VENUE ROUTES
      // ════════════════════════════════════════════

      // GET /api/venues  – List all public venues
      if (route("GET", /^\/api\/venues$/)) {
        requireUser(user);

        const { results } = await env.DB.prepare(
          `SELECT v.id, v.title, v.address, v.open_hours, v.photo_ids, v.lat_long,
                  EXISTS (SELECT 1 FROM venue_favorites f
                          WHERE f.venue_id = v.id AND f.user_id = ?) AS is_favorite,
                  ${VENUE_EXTRAS_SQL}
           FROM venue_profile v
           WHERE v.public_status = 1`,
        )
          .bind(user.userId)
          .all();

        return json(results.map(formatVenue));
      }

      // GET /api/venue/:id  – Venue profile (non-public venues only for the owner)
      if ((match = route("GET", /^\/api\/venue\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        // Explicit columns – never return email or password
        const venue = await env.DB.prepare(
          `SELECT v.id, v.username, v.user_type, v.title, v.address, v.about, v.status,
                  v.photo_ids, v.public_status, v.open_hours, v.lat_long,
                  v.create_date, v.update_date,
                  EXISTS (SELECT 1 FROM venue_favorites f
                          WHERE f.venue_id = v.id AND f.user_id = ?) AS is_favorite,
                  (SELECT r.rating FROM venue_ratings r
                   WHERE r.venue_id = v.id AND r.user_id = ?) AS my_rating,
                  ${VENUE_EXTRAS_SQL}
           FROM venue_profile v WHERE v.id = ?`,
        )
          .bind(user.userId, user.userId, id)
          .first();

        if (!venue || (!venue.public_status && venue.id !== user.userId)) {
          return json({ error: "Not found" }, 404);
        }

        const result = { ...formatVenue(venue), my_rating: venue.my_rating ?? null };

        if (venue.id === user.userId) {
          // The venue's own totals (shown on its profile)
          result.stats = await env.DB.prepare(
            `SELECT
               (SELECT COUNT(*) FROM venue_views WHERE venue_id = ?) AS views_total,
               (SELECT COUNT(*) FROM venue_views WHERE venue_id = ? AND day >= ?) AS views_30d,
               (SELECT COUNT(*) FROM venue_favorites WHERE venue_id = ?) AS favorites`,
          )
            .bind(id, id, new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), id)
            .first();
        } else {
          // One view per person per day; recorded after the response is sent
          ctx.waitUntil(
            env.DB.prepare("INSERT OR IGNORE INTO venue_views (venue_id, viewer_id, day) VALUES (?, ?, ?)")
              .bind(id, user.userId, new Date().toISOString().slice(0, 10))
              .run()
              .catch((err) => console.error("Venue view not recorded:", err)),
          );
        }

        return json(result);
      }

      // PUT /api/venue/:id  – Update own venue profile (venues only)
      if ((match = route("PUT", /^\/api\/venue\/([^/]+)$/))) {
        requireUser(user);
        const userId = parseId(match[1]);

        // Must be the owner and a venue (type 2)
        if (user.userId !== userId || user.userType !== 2) {
          return json({ error: "Forbidden" }, 403);
        }

        const body = await readJson(request);

        const updates = [];
        const values = [];

        // Image keys must point to the venue's own folder
        if ("photo_ids" in body) {
          const keys = splitList(body.photo_ids).map(toImageKey);
          if (!keys.every((key) => isKeyIn(key, venueImagePrefix(userId)))) {
            return json({ error: "Invalid photo_ids" }, 400);
          }
          updates.push("photo_ids = ?");
          values.push(keys.join(","));
        }

        if ("username" in body) {
          const username = String(body.username ?? "").trim();
          await checkUsername(env.DB, username, userId); // unique, valid format
          updates.push("username = ?");
          values.push(username);
        }
        if ("title" in body) {
          updates.push("title = ?");
          values.push(limitText(body.title, 80, "title"));
        }
        if ("address" in body) {
          updates.push("address = ?");
          values.push(limitText(body.address, 200, "address"));
        }
        if ("about" in body) {
          updates.push("about = ?");
          values.push(limitText(body.about, 2000, "about"));
        }
        if ("status" in body) {
          updates.push("status = ?");
          values.push(limitText(body.status, 300, "status"));
        }
        if ("public_status" in body) {
          if (body.public_status !== 0 && body.public_status !== 1) {
            return json({ error: "public_status must be 0 or 1" }, 400);
          }
          updates.push("public_status = ?");
          values.push(body.public_status);
        }
        if ("open_hours" in body) {
          updates.push("open_hours = ?");
          values.push(limitText(body.open_hours, 100, "open_hours"));
        }
        if ("lat_long" in body) {
          // "lat,long" with real coordinates, or empty to clear
          const latLong = String(body.lat_long ?? "").trim();
          const [lat, lon] = latLong.split(",").map(Number);
          if (
            latLong &&
            !(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(latLong) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
          ) {
            return json({ error: "Invalid lat_long" }, 400);
          }
          updates.push("lat_long = ?");
          values.push(latLong || null);
        }

        // Venue types replace the current set (array or comma-separated string)
        let types = null;
        if ("types" in body) {
          types = [...new Set(splitList(body.types))];
          if (!types.every((type) => VENUE_TYPES.includes(type))) {
            return json({ error: "Invalid types" }, 400);
          }
        }

        if (updates.length === 0 && !types)
          return json({ error: "No fields to update" }, 400);

        updates.push("update_date = ?");
        values.push(new Date().toISOString(), userId);

        // Profile fields and types are saved together in one transaction
        const statements = [
          env.DB.prepare(
            `UPDATE venue_profile SET ${updates.join(", ")} WHERE id = ?`,
          ).bind(...values),
        ];
        if (types) {
          statements.push(
            env.DB.prepare("DELETE FROM venue_types WHERE venue_id = ?").bind(
              userId,
            ),
            ...types.map((type) =>
              env.DB.prepare(
                "INSERT INTO venue_types (venue_id, type) VALUES (?, ?)",
              ).bind(userId, type),
            ),
          );
        }
        const [result] = await env.DB.batch(statements);

        if (result.meta.changes === 0)
          return json({ error: "Venue profile not found" }, 404);

        return json({ success: true, message: "Venue profile updated" });
      }

      // PUT / DELETE /api/venues/:id/favorite  – Favorite / unfavorite a venue
      if ((match = toggleRoute(/^\/api\/venues\/([^/]+)\/favorite$/))) {
        requireUser(user);
        const venueId = parseId(match[1]);

        const venue = await env.DB.prepare(
          "SELECT id FROM venue_profile WHERE id = ? AND public_status = 1",
        )
          .bind(venueId)
          .first();

        if (!venue) return json({ error: "Venue not found" }, 404);

        const statement =
          method === "PUT"
            ? "INSERT OR IGNORE INTO venue_favorites (user_id, venue_id) VALUES (?, ?)"
            : "DELETE FROM venue_favorites WHERE user_id = ? AND venue_id = ?";
        await env.DB.prepare(statement).bind(user.userId, venueId).run();

        return json({ is_favorite: method === "PUT" });
      }

      // PUT / DELETE /api/venues/:id/rating  – Rate a venue 1–5 / remove own rating
      if ((match = toggleRoute(/^\/api\/venues\/([^/]+)\/rating$/))) {
        requireUser(user);
        if (user.userType !== 1) {
          return json({ error: "Only users can rate venues" }, 403);
        }
        const venueId = parseId(match[1]);

        const venue = await env.DB.prepare(
          "SELECT id FROM venue_profile WHERE id = ? AND public_status = 1",
        )
          .bind(venueId)
          .first();

        if (!venue) return json({ error: "Venue not found" }, 404);

        let rating = null;
        if (method === "PUT") {
          ({ rating } = await readJson(request));
          if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return json(
              { error: "Rating must be a whole number from 1 to 5" },
              400,
            );
          }
          await env.DB.prepare(
            `INSERT INTO venue_ratings (user_id, venue_id, rating) VALUES (?, ?, ?)
             ON CONFLICT (user_id, venue_id)
             DO UPDATE SET rating = excluded.rating, update_date = CURRENT_TIMESTAMP`,
          )
            .bind(user.userId, venueId, rating)
            .run();
        } else {
          await env.DB.prepare(
            "DELETE FROM venue_ratings WHERE user_id = ? AND venue_id = ?",
          )
            .bind(user.userId, venueId)
            .run();
        }

        const summary = await env.DB.prepare(
          `SELECT ROUND(AVG(rating), 1) AS rating_avg, COUNT(*) AS rating_count
           FROM venue_ratings WHERE venue_id = ?`,
        )
          .bind(venueId)
          .first();

        return json({
          my_rating: rating,
          rating_avg: summary.rating_avg ?? null,
          rating_count: summary.rating_count,
        });
      }

      // ════════════════════════════════════════════
      // EVENT ROUTES
      // ════════════════════════════════════════════

      // Events of non-public venues are only visible to that venue.
      // Bind the caller's id twice, then any extra filter values.
      const EVENT_SELECT = `
        SELECT e.*,
               EXISTS (SELECT 1 FROM event_interests i
                       WHERE i.event_id = e.id AND i.user_id = ?) AS is_interested,
               (SELECT COUNT(*) FROM event_interests g WHERE g.event_id = e.id) AS going_count
        FROM events e
        JOIN venue_profile v ON v.id = e.venue_id
        WHERE (v.public_status = 1 OR v.id = ?)`;

      const formatEvent = (event) => ({
        ...event,
        photo_id: toImageUrl(event.photo_id),
        is_interested: !!event.is_interested,
      });

      // GET /api/events  – Upcoming events, soonest first
      //   ?venue_id=   one venue's events
      //   ?include_past=1   also past events (only for the venue's own list)
      if (route("GET", /^\/api\/events$/)) {
        requireUser(user);
        const venueId = searchParams.get("venue_id") ? parseId(searchParams.get("venue_id")) : null;
        const includePast = searchParams.get("include_past") === "1" && venueId === user.userId;

        const { results } = await env.DB.prepare(
          `${EVENT_SELECT}
             AND (? IS NULL OR e.venue_id = ?)
             AND (? = 1 OR e.starts_at >= ?)
           ORDER BY ${includePast ? "e.starts_at DESC" : "e.starts_at ASC"}`,
        )
          .bind(user.userId, user.userId, venueId, venueId, includePast ? 1 : 0, upcomingCutoff())
          .all();

        return json(results.map(formatEvent));
      }

      // GET /api/events/:id  – Single event
      if ((match = route("GET", /^\/api\/events\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        const event = await env.DB.prepare(`${EVENT_SELECT} AND e.id = ?`)
          .bind(user.userId, user.userId, id)
          .first();

        if (!event) return json({ error: "Event not found" }, 404);

        return json(formatEvent(event));
      }

      // POST /api/events  – Create event (venues only)
      if (route("POST", /^\/api\/events$/)) {
        requireUser(user);
        if (user.userType !== 2) {
          return json({ error: "Only venues can do this" }, 403);
        }

        const body = await readJson(request);
        const { venue_id, title, about } = body;
        const photo_id = toImageKey(body.photo_id);

        if (!venue_id || !title || !body.starts_at || !about || !photo_id) {
          return json({ error: "Missing required fields" }, 400);
        }
        limitText(title, 100, "title");
        limitText(about, 2000, "about");
        const startsAt = parseStartsAt(body.starts_at);

        // Venue can only create events for itself
        if (parseInt(venue_id) !== user.userId) {
          return json(
            { error: "Unauthorized: venue_id does not match user" },
            403,
          );
        }

        // The photo must be one this venue just uploaded (temp folder)
        if (!isKeyIn(photo_id, eventTempPrefix(user.userId))) {
          return json({ error: "Invalid photo_id" }, 400);
        }

        // Insert event
        const result = await env.DB.prepare(
          // `time` gets the same value, for older app versions
          "INSERT INTO events (venue_id, title, time, starts_at, about, photo_id, create_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
          .bind(
            user.userId,
            title,
            startsAt,
            startsAt,
            about,
            photo_id,
            new Date().toISOString(),
          )
          .run();

        const eventId = result.meta.last_row_id;
        let newPhotoId = photo_id;

        // Move the image from the temp folder to the event's own folder
        const object = await env.R2.get(photo_id);
        if (object) {
          const newKey = `${eventImagePrefix(eventId)}${crypto.randomUUID()}.jpg`;
          await env.R2.put(newKey, await object.arrayBuffer(), {
            httpMetadata: {
              contentType: object.httpMetadata.contentType || "image/jpeg",
            },
          });
          await env.R2.delete(photo_id);
          newPhotoId = newKey;

          await env.DB.prepare("UPDATE events SET photo_id = ? WHERE id = ?")
            .bind(newKey, eventId)
            .run();
        }

        return json(
          { success: true, id: eventId, photo_id: toImageUrl(newPhotoId) },
          201,
        );
      }

      // PUT / DELETE /api/events/:id/interest  – Mark / unmark interest in an event
      if ((match = toggleRoute(/^\/api\/events\/([^/]+)\/interest$/))) {
        requireUser(user);
        const eventId = parseId(match[1]);

        const event = await env.DB.prepare(`${EVENT_SELECT} AND e.id = ?`)
          .bind(user.userId, user.userId, eventId)
          .first();

        if (!event) return json({ error: "Event not found" }, 404);

        const statement =
          method === "PUT"
            ? "INSERT OR IGNORE INTO event_interests (user_id, event_id) VALUES (?, ?)"
            : "DELETE FROM event_interests WHERE user_id = ? AND event_id = ?";
        await env.DB.prepare(statement).bind(user.userId, eventId).run();

        return json({ is_interested: method === "PUT" });
      }

      // PUT /api/events/:id  – Update event (owner venue only)
      if ((match = route("PUT", /^\/api\/events\/([^/]+)$/))) {
        requireUser(user);
        if (user.userType !== 2) {
          return json({ error: "Only venues can do this" }, 403);
        }

        const id = parseId(match[1]);
        const body = await readJson(request);
        const { title, about } = body;
        const photo_id = toImageKey(body.photo_id);

        const updates = [];
        const values = [];

        if (title) {
          updates.push("title = ?");
          values.push(limitText(title, 100, "title"));
        }
        if (body.starts_at) {
          const startsAt = parseStartsAt(body.starts_at);
          updates.push("starts_at = ?", "time = ?");
          values.push(startsAt, startsAt);
        }
        if (about) {
          updates.push("about = ?");
          values.push(limitText(about, 2000, "about"));
        }
        if (photo_id !== undefined) {
          updates.push("photo_id = ?");
          values.push(photo_id);
        }

        if (updates.length === 0)
          return json({ error: "No fields to update" }, 400);

        values.push(new Date().toISOString(), id);

        // Verify ownership
        const event = await env.DB.prepare(
          "SELECT venue_id, photo_id AS old_photo_id FROM events WHERE id = ?",
        )
          .bind(id)
          .first();

        if (!event || Number(event.venue_id) !== user.userId) {
          return json({ error: "Event not found or unauthorized" }, 404);
        }

        // A new photo must live in this event's own folder
        if (
          photo_id &&
          photo_id !== event.old_photo_id &&
          !isKeyIn(photo_id, eventImagePrefix(id))
        ) {
          return json({ error: "Invalid photo_id" }, 400);
        }

        // Delete old image if a new one is provided (only if it is the event's own image)
        if (
          photo_id &&
          photo_id !== event.old_photo_id &&
          isKeyIn(event.old_photo_id, eventImagePrefix(id))
        ) {
          await env.R2.delete(event.old_photo_id);
        }

        const result = await env.DB.prepare(
          `UPDATE events SET ${updates.join(", ")}, update_date = ? WHERE id = ?`,
        )
          .bind(...values)
          .run();

        if (result.meta.changes === 0)
          return json({ error: "Failed to update event" }, 500);

        return json({ success: true, message: "Event updated" });
      }

      // DELETE /api/events/:id  – Delete event (owner venue only)
      if ((match = route("DELETE", /^\/api\/events\/([^/]+)$/))) {
        requireUser(user);
        if (user.userType !== 2) {
          return json({ error: "Only venues can do this" }, 403);
        }

        const eventId = parseId(match[1]);

        const event = await env.DB.prepare(
          "SELECT venue_id, photo_id FROM events WHERE id = ?",
        )
          .bind(eventId)
          .first();

        if (!event || Number(event.venue_id) !== user.userId) {
          return json({ error: "Event not found or unauthorized" }, 404);
        }

        // Delete associated image (only if it is the event's own image)
        if (isKeyIn(event.photo_id, eventImagePrefix(eventId))) {
          await env.R2.delete(event.photo_id);
        }

        await env.DB.batch([
          env.DB.prepare("DELETE FROM event_interests WHERE event_id = ?").bind(
            eventId,
          ),
          env.DB.prepare("DELETE FROM events WHERE id = ?").bind(eventId),
        ]);

        return json({ success: true, message: "Event deleted successfully" });
      }

      // ════════════════════════════════════════════
      // POSTS ROUTES
      // ════════════════════════════════════════════

      // GET /api/posts  – List posts, newest first (?user_id= for one person's posts)
      if (route("GET", /^\/api\/posts$/)) {
        requireUser(user);
        const userIdParam = searchParams.get("user_id");
        const authorId = userIdParam ? parseId(userIdParam) : null;

        const { results } = await env.DB.prepare(
          `
          SELECT
            p.id,
            p.user_id,
            (SELECT ld.user_type FROM login_data ld WHERE ld.id = p.user_id) AS user_type,
            up.username,
            up.profile_photo AS user_image,
            p.photo_id AS post_image,
            p.photo_ratio,
            p.post_text AS caption,
            p.location_tag,
            p.create_date AS date,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
            EXISTS (SELECT 1 FROM post_likes l
                    WHERE l.post_id = p.id AND l.user_id = ?) AS isLiked
          FROM posts p
          LEFT JOIN user_profile up ON p.user_id = up.id
          WHERE (? IS NULL OR p.user_id = ?)
            AND ${NOT_BLOCKED_SQL("p.user_id")}
            AND (p.user_id IN (SELECT id FROM venue_profile) OR ${COMPLETE_PROFILE_SQL("up")})
          ORDER BY p.create_date DESC
        `,
        )
          .bind(user.userId, authorId, authorId, user.userId, user.userId)
          .all();

        return json(
          results.map((post) => ({
            ...post,
            post_image: toImageUrl(post.post_image),
            user_image:
              toImageUrl(post.user_image) ||
              "https://picsum.photos/50/50?random=" + post.user_id, // fallback avatar
            isLiked: !!post.isLiked,
          })),
        );
      }

      // POST /api/posts  – Create a post
      if (route("POST", /^\/api\/posts$/)) {
        requireUser(user);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);

        const body = await readJson(request);
        const { user_id, post_text, location_tag } = body;
        const photo_id = toImageKey(body.photo_id);
        const photo_ratio = cleanPhotoRatio(body.photo_ratio);

        if (!user_id || !photo_id) {
          return json(
            { error: "Missing required fields: user_id and photo_id" },
            400,
          );
        }

        const parsedUserId = parseInt(user_id);

        // Can only post as yourself
        if (user.userId !== parsedUserId) {
          return json(
            { error: "Unauthorized: Cannot create post for another user" },
            403,
          );
        }

        // Personal accounts need photo, names and username before posting
        if (user.userType === 1) {
          const author = await env.DB.prepare(
            `SELECT ${COMPLETE_PROFILE_SQL("user_profile")} AS complete FROM user_profile WHERE id = ?`,
          )
            .bind(parsedUserId)
            .first();
          if (!author?.complete) {
            throw new HttpError(403, "Complete your profile first", "profile_incomplete");
          }
        }

        // The photo must be one of the user's own uploads
        if (!isKeyIn(photo_id, userImagePrefix(parsedUserId))) {
          return json({ error: "Invalid photo_id" }, 400);
        }

        // Make sure the user exists
        const userCheck = await env.DB.prepare(
          "SELECT id FROM login_data WHERE id = ?",
        )
          .bind(parsedUserId)
          .first();

        if (!userCheck)
          return json({ error: "Invalid user_id: User not found" }, 400);

        const result = await env.DB.prepare(
          "INSERT INTO posts (user_id, post_text, location_tag, photo_id, photo_ratio) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(
            parsedUserId,
            limitText(post_text || "", 2200, "post_text"),
            limitText(location_tag || "", 100, "location_tag"),
            photo_id,
            photo_ratio,
          )
          .run();

        if (result.meta.changes === 0) {
          return json({ error: "Failed to insert post into database" }, 500);
        }

        return json({ id: result.meta.last_row_id }, 201);
      }

      // PUT / DELETE /api/posts/:id/like  – Like / unlike a post
      if ((match = toggleRoute(/^\/api\/posts\/([^/]+)\/like$/))) {
        requireUser(user);
        const postId = parseId(match[1]);

        const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ?")
          .bind(postId)
          .first();

        if (!post) return json({ error: "Post not found" }, 404);

        const statement =
          method === "PUT"
            ? "INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)"
            : "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?";
        await env.DB.prepare(statement).bind(postId, user.userId).run();

        const { likes } = await env.DB.prepare(
          "SELECT COUNT(*) AS likes FROM post_likes WHERE post_id = ?",
        )
          .bind(postId)
          .first();

        return json({ isLiked: method === "PUT", likes });
      }

      // DELETE /api/posts/:id  – Delete own post
      if ((match = route("DELETE", /^\/api\/posts\/([^/]+)$/))) {
        requireUser(user);
        const postId = parseId(match[1]);

        const post = await env.DB.prepare(
          "SELECT user_id, photo_id FROM posts WHERE id = ?",
        )
          .bind(postId)
          .first();

        if (!post) return json({ error: "Post not found" }, 404);

        // Only the author can delete
        if (post.user_id !== user.userId) {
          return json(
            { error: "Unauthorized: Cannot delete another user's post" },
            403,
          );
        }

        // Delete associated image (only if it is in the author's own folder)
        if (isKeyIn(post.photo_id, userImagePrefix(user.userId))) {
          await env.R2.delete(post.photo_id);
        }

        await env.DB.batch([
          env.DB.prepare("DELETE FROM post_likes WHERE post_id = ?").bind(
            postId,
          ),
          env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(postId),
        ]);

        return json({ success: true, message: "Post deleted successfully" });
      }

      // ════════════════════════════════════════════
      // FEEDBACK
      // ════════════════════════════════════════════

      // POST /api/feedback  – Send feedback from the app
      if (route("POST", /^\/api\/feedback$/)) {
        requireUser(user);
        await rateLimit(env.WRITE_LIMITER, `write:${user.userId}`);
        const { category, message } = await readJson(request);
        const text = typeof message === "string" ? message.trim() : "";

        if (!FEEDBACK_CATEGORIES.includes(category)) {
          return json({ error: "Invalid category" }, 400);
        }
        if (text.length < 5) {
          return json({ error: "Please write a little more" }, 400);
        }
        if (text.length > FEEDBACK_MAX_LENGTH) {
          return json(
            { error: `Feedback is too long (max ${FEEDBACK_MAX_LENGTH} characters)` },
            400,
          );
        }

        await env.DB.prepare(
          "INSERT INTO feedback (user_id, category, message) VALUES (?, ?, ?)",
        )
          .bind(user.userId, category, text)
          .run();

        return json({ success: true }, 201);
      }

      // Connections, Discover, chat requests, chats, push tokens (src/social.js)
      const socialResponse = await handleSocial({
        request,
        env,
        ctx,
        user,
        method,
        route,
        searchParams,
        rateLimit,
      });
      if (socialResponse) return socialResponse;

      // ── Fallback ─────────────────────────────────
      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) {
        return json(
          err.code ? { error: err.message, code: err.code } : { error: err.message },
          err.status,
        );
      }
      console.error(`Unhandled error on ${method} ${pathname}:`, err);
      return json({ error: "Server error" }, 500);
    }
  },

  // Cron (see wrangler.toml): removes ended chats so those pairs can meet again
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      cleanUpExpiredChats(env).then((count) => console.log(`Cleaned up ${count} ended chats`)),
    );
  },
};
