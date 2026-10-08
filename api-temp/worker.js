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
 * @param {string} secret==
 * @returns {Promise<string>} JWT string
 */
async function generateToken(userId, userType, secret) {
  // JWT header
  const header = { alg: "HS256", typ: "JWT" };

  // Payload: identity + expiry (Unix timestamp)
  const payload = {
    userId,
    userType,
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
 * Checks a password against the stored value.
 * Legacy plain-text values are still accepted so existing accounts can log in;
 * they are re-hashed on successful login.
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;

  if (!stored.startsWith("pbkdf2$")) {
    const encoder = new TextEncoder();
    return timingSafeEqual(encoder.encode(password), encoder.encode(stored));
  }

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
// Image helpers
// ────────────────────────────────────────────────

const IMAGE_DOMAIN = "https://night-life-api.elevator-rand.workers.dev/images";

// R2 folders that belong to a given user / venue / event
const userImagePrefix = (userId) => `night-life-images/users/${userId}/`;
const venueImagePrefix = (userId) => `venues/${userId}/`;
const eventTempPrefix = (userId) => `events/temp/${userId}/`;
const eventImagePrefix = (eventId) => `events/${eventId}/`;

function isKeyIn(key, prefix) {
  return typeof key === "string" && key.startsWith(prefix);
}

/**
 * Stored key → full public URL (the API always returns full URLs).
 * Values that are already URLs (legacy data) are returned unchanged.
 */
function toImageUrl(key) {
  if (!key) return null;
  return /^https?:\/\//.test(key) ? key : `${IMAGE_DOMAIN}/${key}`;
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
// Request / response helpers
// ────────────────────────────────────────────────

/**
 * JSON response with CORS header.
 */
function json(data, status = 200) {
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
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function requireUser(user) {
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
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
    const user = token ? await verifyToken(token, JWT_SECRET) : null;
    // `user` is either the decoded payload { userId, userType, exp } or null

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

      // POST /api/register  – Create new account
      if (route("POST", /^\/api\/register$/)) {
        const { email, password, user_type } = await readJson(request);

        if (!email || !password || !user_type) {
          return json({ error: "Missing required fields" }, 400);
        }

        // user_type must be 1 (user) or 2 (venue)
        if (user_type !== 1 && user_type !== 2) {
          return json({ error: "Invalid user type" }, 400);
        }

        // Check if email already exists
        const emailCheck = await env.DB.prepare(
          "SELECT id FROM login_data WHERE email = ?",
        )
          .bind(email)
          .first();

        if (emailCheck) return json({ error: "Email already exists" }, 400);

        // Insert new login record with a hashed password
        // (the profile row is created by a DB trigger)
        const passwordHash = await hashPassword(password);
        const result = await env.DB.prepare(
          "INSERT INTO login_data (email, password, user_type, create_date) VALUES (?, ?, ?, ?)",
        )
          .bind(email, passwordHash, user_type, new Date().toISOString())
          .run();

        const userId = result.meta.last_row_id;
        const token = await generateToken(userId, user_type, JWT_SECRET);

        return json({ token, userId, userType: user_type });
      }

      // POST /api/login  – Authenticate and return JWT
      if (route("POST", /^\/api\/login$/)) {
        const { email, password } = await readJson(request);

        if (!email || !password) {
          return json({ error: "Missing required fields" }, 400);
        }

        const account = await env.DB.prepare(
          "SELECT id, password, user_type FROM login_data WHERE email = ?",
        )
          .bind(email)
          .first();

        if (!account || !(await verifyPassword(password, account.password))) {
          return json({ error: "Invalid credentials" }, 401);
        }

        // Upgrade legacy plain-text passwords to a hash
        if (!account.password.startsWith("pbkdf2$")) {
          const passwordHash = await hashPassword(password);
          await env.DB.prepare(
            "UPDATE login_data SET password = ?, update_date = ? WHERE id = ?",
          )
            .bind(passwordHash, new Date().toISOString(), account.id)
            .run();
        }

        const token = await generateToken(
          account.id,
          account.user_type,
          JWT_SECRET,
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
      if ((match = route("PUT", /^\/api\/login\/([^/]+)$/))) {
        requireUser(user);
        const id = parseId(match[1]);

        // Only the owner may change their own login record
        if (id !== user.userId) return json({ error: "Forbidden" }, 403);

        const { password, last_active } = await readJson(request);

        const updates = [];
        const values = [];

        if (password) {
          updates.push("password = ?");
          values.push(await hashPassword(password));
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
                  ticket_ids, bio_text, create_date, update_date
           FROM user_profile WHERE id = ?`,
        )
          .bind(id)
          .first();

        if (!profile) return json({ error: "Not found" }, 404);

        const counts = await env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
             (SELECT COUNT(*) FROM follows WHERE follower_id = ?)  AS following_count,
             (SELECT COUNT(*) FROM posts   WHERE user_id = ?)      AS posts_count,
             EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?) AS is_following`,
        )
          .bind(id, id, id, user.userId, id)
          .first();

        const { ticket_ids, ...publicProfile } = profile;
        const result = {
          ...publicProfile,
          profile_photo: toImageUrl(profile.profile_photo),
          followers_count: counts.followers_count,
          following_count: counts.following_count,
          posts_count: counts.posts_count,
          is_following: !!counts.is_following,
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
        }

        return json(result);
      }

      // PUT /api/user/:id  – Update own user profile (regular users only)
      if ((match = route("PUT", /^\/api\/user\/([^/]+)$/))) {
        requireUser(user);
        const userId = parseId(match[1]);

        // Must be the owner and a regular user (type 1)
        if (user.userId !== userId || user.userType !== 1) {
          return json({ error: "Unauthorized" }, 401);
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
          updates.push("username = ?");
          values.push(body.username);
        }
        if ("first_name" in body) {
          updates.push("first_name = ?");
          values.push(body.first_name);
        }
        if ("last_name" in body) {
          updates.push("last_name = ?");
          values.push(body.last_name);
        }
        if ("ticket_ids" in body) {
          updates.push("ticket_ids = ?");
          values.push(body.ticket_ids);
        }
        if ("bio_text" in body) {
          updates.push("bio_text = ?");
          values.push(body.bio_text);
        }

        if (updates.length === 0)
          return json({ error: "No fields to update" }, 400);

        values.push(new Date().toISOString(), userId); // update_date + WHERE id

        const result = await env.DB.prepare(
          `UPDATE user_profile SET ${updates.join(", ")}, update_date = ? WHERE id = ?`,
        )
          .bind(...values)
          .run();

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
            "DELETE FROM follows WHERE follower_id = ? OR following_id = ?",
          ).bind(userId, userId),
          env.DB.prepare(
            "DELETE FROM venue_ratings WHERE user_id = ? OR venue_id = ?",
          ).bind(userId, userId),
          env.DB.prepare("DELETE FROM venue_types WHERE venue_id = ?").bind(
            userId,
          ),
          // Feedback is kept, just no longer linked to the account
          env.DB.prepare(
            "UPDATE feedback SET user_id = NULL WHERE user_id = ?",
          ).bind(userId),
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

      // PUT / DELETE /api/users/:id/follow  – Follow / unfollow a user
      if ((match = toggleRoute(/^\/api\/users\/([^/]+)\/follow$/))) {
        requireUser(user);
        const targetId = parseId(match[1]);

        if (targetId === user.userId)
          return json({ error: "You cannot follow yourself" }, 400);

        const target = await env.DB.prepare(
          "SELECT id FROM login_data WHERE id = ?",
        )
          .bind(targetId)
          .first();

        if (!target) return json({ error: "User not found" }, 404);

        const statement =
          method === "PUT"
            ? "INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)"
            : "DELETE FROM follows WHERE follower_id = ? AND following_id = ?";
        await env.DB.prepare(statement).bind(user.userId, targetId).run();

        const { followers_count } = await env.DB.prepare(
          "SELECT COUNT(*) AS followers_count FROM follows WHERE following_id = ?",
        )
          .bind(targetId)
          .first();

        return json({ following: method === "PUT", followers_count });
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

        return json({ ...formatVenue(venue), my_rating: venue.my_rating ?? null });
      }

      // PUT /api/venue/:id  – Update own venue profile (venues only)
      if ((match = route("PUT", /^\/api\/venue\/([^/]+)$/))) {
        requireUser(user);
        const userId = parseId(match[1]);

        // Must be the owner and a venue (type 2)
        if (user.userId !== userId || user.userType !== 2) {
          return json({ error: "Unauthorized" }, 401);
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
          updates.push("username = ?");
          values.push(body.username);
        }
        if ("title" in body) {
          updates.push("title = ?");
          values.push(body.title);
        }
        if ("address" in body) {
          updates.push("address = ?");
          values.push(body.address);
        }
        if ("about" in body) {
          updates.push("about = ?");
          values.push(body.about);
        }
        if ("status" in body) {
          updates.push("status = ?");
          values.push(body.status);
        }
        if ("public_status" in body) {
          updates.push("public_status = ?");
          values.push(body.public_status);
        }
        if ("open_hours" in body) {
          updates.push("open_hours = ?");
          values.push(body.open_hours);
        }
        if ("lat_long" in body) {
          updates.push("lat_long = ?");
          values.push(body.lat_long);
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
                       WHERE i.event_id = e.id AND i.user_id = ?) AS is_interested
        FROM events e
        JOIN venue_profile v ON v.id = e.venue_id
        WHERE (v.public_status = 1 OR v.id = ?)`;

      const formatEvent = (event) => ({
        ...event,
        photo_id: toImageUrl(event.photo_id),
        is_interested: !!event.is_interested,
      });

      // GET /api/events  – List events (optionally filter by venue_id)
      if (route("GET", /^\/api\/events$/)) {
        requireUser(user);
        const venueIdParam = searchParams.get("venue_id");

        const { results } = venueIdParam
          ? await env.DB.prepare(`${EVENT_SELECT} AND e.venue_id = ?`)
              .bind(user.userId, user.userId, parseId(venueIdParam))
              .all()
          : await env.DB.prepare(EVENT_SELECT)
              .bind(user.userId, user.userId)
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
        if (!user || user.userType !== 2) {
          return json({ error: "Unauthorized or not a venue" }, 401);
        }

        const body = await readJson(request);
        const { venue_id, title, time, about } = body;
        const photo_id = toImageKey(body.photo_id);

        if (!venue_id || !title || !time || !about || !photo_id) {
          return json({ error: "Missing required fields" }, 400);
        }

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
          "INSERT INTO events (venue_id, title, time, about, photo_id, create_date) VALUES (?, ?, ?, ?, ?, ?)",
        )
          .bind(
            user.userId,
            title,
            time,
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
        if (!user || user.userType !== 2) {
          return json({ error: "Unauthorized or not a venue" }, 401);
        }

        const id = parseId(match[1]);
        const body = await readJson(request);
        const { title, time, about } = body;
        const photo_id = toImageKey(body.photo_id);

        const updates = [];
        const values = [];

        if (title) {
          updates.push("title = ?");
          values.push(title);
        }
        if (time) {
          updates.push("time = ?");
          values.push(time);
        }
        if (about) {
          updates.push("about = ?");
          values.push(about);
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
        if (!user || user.userType !== 2) {
          return json({ error: "Unauthorized or not a venue" }, 401);
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

      // GET /api/posts  – List all posts (newest first)
      if (route("GET", /^\/api\/posts$/)) {
        requireUser(user);

        const { results } = await env.DB.prepare(
          `
          SELECT
            p.id,
            p.user_id,
            up.username,
            up.profile_photo AS user_image,
            p.photo_id AS post_image,
            p.post_text AS caption,
            p.location_tag,
            p.create_date AS date,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
            EXISTS (SELECT 1 FROM post_likes l
                    WHERE l.post_id = p.id AND l.user_id = ?) AS isLiked
          FROM posts p
          LEFT JOIN user_profile up ON p.user_id = up.id
          ORDER BY p.create_date DESC
        `,
        )
          .bind(user.userId)
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

        const body = await readJson(request);
        const { user_id, post_text, location_tag } = body;
        const photo_id = toImageKey(body.photo_id);

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
          "INSERT INTO posts (user_id, post_text, location_tag, photo_id) VALUES (?, ?, ?, ?)",
        )
          .bind(parsedUserId, post_text || "", location_tag || "", photo_id)
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

      // ── Fallback ─────────────────────────────────
      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, err.status);
      }
      console.error(`Unhandled error on ${method} ${pathname}:`, err);
      return json({ error: "Server error" }, 500);
    }
  },
};
