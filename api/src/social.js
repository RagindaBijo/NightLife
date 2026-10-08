/**
 * Connections and chat (18+ personal accounts only).
 *
 * Two people can chat only when connected:
 *   • a Discover match (both swiped right),
 *   • an accepted "request to chat",
 *   • or they follow each other.
 * A chat lasts CHAT_HOURS. When it ends, the connection ends too: matched or
 * requested pairs have to connect again (mutual followers can just start a new chat).
 * Venues can't chat. Blocking ends everything between two people.
 */
import { DurableObject } from "cloudflare:workers";
import {
  HttpError,
  NOT_BLOCKED_SQL,
  ageFrom,
  isBlockedEitherWay,
  json,
  limitText,
  parseId,
  readJson,
  requireUser,
  toImageUrl,
  upcomingCutoff,
} from "./shared.js";

export const CHAT_HOURS = 24; // Free plan; Plus will get 48
const ADULT_AGE = 18;
const PASS_HIDE_DAYS = 7; // a left swipe hides that person for a week
const DECLINE_QUIET_DAYS = 7; // after a decline, new requests are silently ignored
const MESSAGE_MAX = 1000;
const DISCOVER_LIMIT = 20;

const nowIso = () => new Date().toISOString();
const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString();
const pair = (a, b) => (a < b ? [a, b] : [b, a]);

/** "YYYY-MM-DD": people born on or before this date are adults. */
function adultBirthCutoff() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - ADULT_AGE);
  return d.toISOString().slice(0, 10);
}

// ── Who may use chat ─────────────────────────────

/**
 * The caller must be a personal account, have a date of birth and be 18+.
 * Codes let the app show the right screen (ask for birth date / 18+ notice).
 */
async function requireAdultUser(db, user) {
  requireUser(user);
  const me = await db
    .prepare("SELECT id, user_type, birth_date FROM login_data WHERE id = ?")
    .bind(user.userId)
    .first();
  if (!me || me.user_type !== 1) {
    throw new HttpError(403, "Only personal accounts can use chat", "users_only");
  }
  if (!me.birth_date) {
    throw new HttpError(428, "Date of birth needed", "birth_date_required");
  }
  if (ageFrom(me.birth_date) < ADULT_AGE) {
    throw new HttpError(403, "Chat and Discover are 18+", "under_18");
  }
  return me;
}

/** True if this account is a personal account aged 18+. */
async function isAdultUser(db, id) {
  const row = await db
    .prepare("SELECT user_type, birth_date FROM login_data WHERE id = ?")
    .bind(id)
    .first();
  return !!row && row.user_type === 1 && !!row.birth_date && ageFrom(row.birth_date) >= ADULT_AGE;
}

/**
 * The other person must be an 18+ personal account and not blocked either way.
 * Anything else looks like "not found" (never reveals someone's age).
 */
async function requireReachable(db, meId, targetId) {
  if (targetId === meId) throw new HttpError(400, "That's you", "self");
  if (!(await isAdultUser(db, targetId)) || (await isBlockedEitherWay(db, meId, targetId))) {
    throw new HttpError(404, "Not available", "not_available");
  }
}

async function isMutualFollow(db, a, b) {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?)
            + (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) AS n`,
    )
    .bind(a, b, b, a)
    .first();
  return row.n === 2;
}

async function activeChatBetween(db, a, b) {
  const [x, y] = pair(a, b);
  return db
    .prepare("SELECT * FROM chats WHERE user_a = ? AND user_b = ? AND expires_at > ?")
    .bind(x, y, nowIso())
    .first();
}

// ── Ending / starting connections ────────────────

/**
 * Statements that remove everything between two people: chat, messages,
 * swipes and requests. Used when blocking, ending a chat and on expiry.
 */
export function endConnectionStatements(db, a, b) {
  const [x, y] = pair(a, b);
  return [
    db.prepare(
      "DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? AND user_b = ?)",
    ).bind(x, y),
    db.prepare(
      "DELETE FROM chat_reads WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? AND user_b = ?)",
    ).bind(x, y),
    db.prepare("DELETE FROM chats WHERE user_a = ? AND user_b = ?").bind(x, y),
    db.prepare(
      "DELETE FROM swipes WHERE (swiper_id = ? AND target_id = ?) OR (swiper_id = ? AND target_id = ?)",
    ).bind(a, b, b, a),
    db.prepare(
      "DELETE FROM chat_requests WHERE status = 'pending' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))",
    ).bind(a, b, b, a),
  ];
}

/** Statements removing all of one account's chat data (account deletion). */
export function deleteSocialDataStatements(db, userId) {
  return [
    db.prepare(
      "DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? OR user_b = ?)",
    ).bind(userId, userId),
    db.prepare(
      "DELETE FROM chat_reads WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? OR user_b = ?)",
    ).bind(userId, userId),
    db.prepare("DELETE FROM chat_reads WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM chats WHERE user_a = ? OR user_b = ?").bind(userId, userId),
    db.prepare("DELETE FROM swipes WHERE swiper_id = ? OR target_id = ?").bind(userId, userId),
    db.prepare("DELETE FROM chat_requests WHERE from_id = ? OR to_id = ?").bind(userId, userId),
    db.prepare("DELETE FROM push_tokens WHERE user_id = ?").bind(userId),
  ];
}

/** Creates the pair's chat (after clearing an old, expired one). Returns its id. */
async function createChat(db, a, b, source) {
  const [x, y] = pair(a, b);
  const created = new Date();
  const expires = new Date(created.getTime() + CHAT_HOURS * 3600 * 1000);
  const results = await db.batch([
    ...endConnectionStatements(db, a, b),
    db.prepare(
      "INSERT INTO chats (user_a, user_b, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(x, y, source, created.toISOString(), expires.toISOString()),
    // Requests between them count as answered
    db.prepare(
      `UPDATE chat_requests SET status = 'accepted', respond_date = ?
       WHERE status = 'pending' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`,
    ).bind(created.toISOString(), a, b, b, a),
  ]);
  return results[results.length - 2].meta.last_row_id;
}

// ── Profile helpers ──────────────────────────────

/** Small public card of a person: id, username, first name, photo. */
async function personCard(db, id) {
  const row = await db
    .prepare("SELECT id, username, first_name, last_name, profile_photo FROM user_profile WHERE id = ?")
    .bind(id)
    .first();
  return row ? { ...row, profile_photo: toImageUrl(row.profile_photo) } : null;
}

/**
 * What the "chat" button on someone's profile should do, from the caller's side:
 *   unavailable | none | requested | incoming | can_message | active
 */
export async function chatStatusFor(db, meId, otherId) {
  if (meId === otherId || !(await isAdultUser(db, meId)) || !(await isAdultUser(db, otherId))) {
    return { chat_status: "unavailable" };
  }
  if (await isBlockedEitherWay(db, meId, otherId)) return { chat_status: "unavailable" };
  const chat = await activeChatBetween(db, meId, otherId);
  if (chat) return { chat_status: "active", chat_id: chat.id };
  if (await isMutualFollow(db, meId, otherId)) return { chat_status: "can_message" };
  const request = await db
    .prepare(
      `SELECT id, from_id FROM chat_requests WHERE status = 'pending'
       AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) LIMIT 1`,
    )
    .bind(meId, otherId, otherId, meId)
    .first();
  if (request?.from_id === meId) return { chat_status: "requested" };
  if (request) return { chat_status: "incoming", request_id: request.id };
  return { chat_status: "none" };
}

// ── Push notifications (Expo) ────────────────────

const PUSH_TEXT = {
  en: {
    match: ["It's a match! 🎉", "You and {name} like each other. Say hi!"],
    request: ["New chat request", "{name} wants to chat with you."],
    accepted: ["Request accepted", "{name} accepted your chat request."],
  },
  ka: {
    match: ["დამთხვევაა! 🎉", "თქვენ და {name} ერთმანეთი მოგეწონათ. მიესალმეთ!"],
    request: ["ჩატის ახალი მოთხოვნა", "{name} გთხოვთ ჩატს."],
    accepted: ["მოთხოვნა მიღებულია", "{name}-მა მიიღო თქვენი ჩატის მოთხოვნა."],
  },
  ru: {
    match: ["Это мэтч! 🎉", "Вы и {name} понравились друг другу. Напишите первым!"],
    request: ["Новый запрос в чат", "{name} хочет пообщаться с вами."],
    accepted: ["Запрос принят", "{name} принял(а) ваш запрос в чат."],
  },
};

/**
 * Sends a push to every device of `userId`. `message` is either
 * { kind: "match"|"request"|"accepted", name } (translated per device) or
 * { title, body } for chat messages. Never throws.
 */
async function sendPush(env, userId, message, data = {}) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT token, language FROM push_tokens WHERE user_id = ?",
    )
      .bind(userId)
      .all();
    if (results.length === 0) return;
    const payload = results.map(({ token, language }) => {
      let { title, body } = message;
      if (message.kind) {
        const [t, b] = (PUSH_TEXT[language] ?? PUSH_TEXT.en)[message.kind];
        title = t;
        body = b.replace("{name}", message.name);
      }
      return { to: token, title, body, sound: "default", data };
    });
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Push failed:", err?.message);
  }
}

/** Tells everyone connected to the chat's live room (Durable Object). */
async function broadcast(env, chatId, event) {
  try {
    const room = env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(String(chatId)));
    await room.fetch("https://chat-room/broadcast", {
      method: "POST",
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.error("Broadcast failed:", err?.message);
  }
}

// ── Routes ───────────────────────────────────────

/**
 * Handles /api/me/*, /api/discover*, /api/chat-requests*, /api/chats*, /api/push-token.
 * Returns a Response, or null if the path isn't a social route.
 */
export async function handleSocial({ request, env, ctx, user, method, route, searchParams, rateLimit }) {
  const db = env.DB;
  let match;

  // GET /api/me/social  – Can I use Discover and chat? (decides which screen to show)
  if (route("GET", /^\/api\/me\/social$/)) {
    requireUser(user);
    const me = await db
      .prepare("SELECT user_type, birth_date FROM login_data WHERE id = ?")
      .bind(user.userId)
      .first();
    const isUser = me?.user_type === 1;
    return json({
      is_user: isUser,
      has_birth_date: !!me?.birth_date,
      is_adult: isUser && !!me?.birth_date && ageFrom(me.birth_date) >= ADULT_AGE,
      chat_hours: CHAT_HOURS,
    });
  }

  // PUT /api/me/birth-date  – One-time: accounts made before sign-up asked for it
  if (route("PUT", /^\/api\/me\/birth-date$/)) {
    requireUser(user);
    const { birth_date } = await readJson(request);
    const me = await db
      .prepare("SELECT user_type, birth_date FROM login_data WHERE id = ?")
      .bind(user.userId)
      .first();
    if (!me || me.user_type !== 1) {
      throw new HttpError(403, "Only personal accounts", "users_only");
    }
    if (me.birth_date) {
      throw new HttpError(409, "Date of birth is already set", "birth_date_set");
    }
    const age = ageFrom(birth_date);
    if (age === null || age > 120) {
      throw new HttpError(400, "Invalid date of birth", "invalid_birth_date");
    }
    await db.prepare("UPDATE login_data SET birth_date = ? WHERE id = ?")
      .bind(birth_date, user.userId)
      .run();
    return json({ has_birth_date: true, is_adult: age >= ADULT_AGE });
  }

  // GET /api/discover  – People to swipe on, best matches first
  if (route("GET", /^\/api\/discover$/)) {
    const me = await requireAdultUser(db, user);
    await rateLimit(env.SEARCH_LIMITER, `search:${me.id}`);
    const now = nowIso();
    const upcoming = upcomingCutoff();

    const { results: people } = await db
      .prepare(
        `SELECT up.id, up.username, up.first_name, up.bio_text, up.profile_photo, ld.birth_date,
                (SELECT COUNT(*) FROM event_interests mine
                   JOIN event_interests theirs ON theirs.event_id = mine.event_id
                   JOIN events e ON e.id = mine.event_id
                 WHERE mine.user_id = ? AND theirs.user_id = up.id AND e.starts_at >= ?) AS shared_events,
                (SELECT COUNT(*) FROM venue_favorites mine
                   JOIN venue_favorites theirs ON theirs.venue_id = mine.venue_id
                 WHERE mine.user_id = ? AND theirs.user_id = up.id) AS shared_venues
         FROM user_profile up
         JOIN login_data ld ON ld.id = up.id
         WHERE up.id != ?
           AND ld.user_type = 1
           AND ld.birth_date IS NOT NULL AND ld.birth_date <= ?
           AND up.username IS NOT NULL
           AND ${NOT_BLOCKED_SQL("up.id")}
           -- not already liked by me (waiting), and not passed in the last week
           AND up.id NOT IN (SELECT target_id FROM swipes
                             WHERE swiper_id = ? AND (liked = 1 OR create_date >= ?))
           -- not already chatting
           AND up.id NOT IN (SELECT CASE WHEN user_a = ? THEN user_b ELSE user_a END
                             FROM chats WHERE (user_a = ? OR user_b = ?) AND expires_at > ?)
           -- no open request either way
           AND up.id NOT IN (SELECT to_id FROM chat_requests WHERE from_id = ? AND status = 'pending')
           AND up.id NOT IN (SELECT from_id FROM chat_requests WHERE to_id = ? AND status = 'pending')
         ORDER BY (shared_events * 3 + shared_venues) DESC,
                  (up.profile_photo IS NOT NULL) DESC,
                  RANDOM()
         LIMIT ?`,
      )
      .bind(
        me.id, upcoming, me.id, me.id, adultBirthCutoff(),
        me.id, me.id,
        me.id, daysAgoIso(PASS_HIDE_DAYS),
        me.id, me.id, me.id, now,
        me.id, me.id,
        DISCOVER_LIMIT,
      )
      .all();

    if (people.length === 0) return json([]);

    // Details for each card in one round trip: events and venues in common, recent photos
    const details = await db.batch(
      people.flatMap((p) => [
        db.prepare(
          `SELECT e.id, e.title, e.starts_at FROM event_interests mine
             JOIN event_interests theirs ON theirs.event_id = mine.event_id
             JOIN events e ON e.id = mine.event_id
           WHERE mine.user_id = ? AND theirs.user_id = ? AND e.starts_at >= ?
           ORDER BY e.starts_at LIMIT 2`,
        ).bind(me.id, p.id, upcoming),
        db.prepare(
          `SELECT v.id, v.title FROM venue_favorites mine
             JOIN venue_favorites theirs ON theirs.venue_id = mine.venue_id
             JOIN venue_profile v ON v.id = mine.venue_id
           WHERE mine.user_id = ? AND theirs.user_id = ? LIMIT 3`,
        ).bind(me.id, p.id),
        db.prepare(
          "SELECT photo_id FROM posts WHERE user_id = ? AND photo_id IS NOT NULL ORDER BY create_date DESC LIMIT 3",
        ).bind(p.id),
      ]),
    );

    return json(
      people.map((p, i) => ({
        id: p.id,
        username: p.username,
        first_name: p.first_name,
        age: ageFrom(p.birth_date),
        bio: p.bio_text || "",
        profile_photo: toImageUrl(p.profile_photo),
        shared_events: details[i * 3].results,
        shared_venues: details[i * 3 + 1].results,
        photos: details[i * 3 + 2].results.map((row) => toImageUrl(row.photo_id)),
      })),
    );
  }

  // POST /api/discover/swipe  { target_id, like }  – A match opens a chat
  if (route("POST", /^\/api\/discover\/swipe$/)) {
    const me = await requireAdultUser(db, user);
    await rateLimit(env.SEARCH_LIMITER, `search:${me.id}`);
    const body = await readJson(request);
    const targetId = parseId(body.target_id);
    const like = body.like === true;
    await requireReachable(db, me.id, targetId);
    if (await activeChatBetween(db, me.id, targetId)) {
      throw new HttpError(409, "Already chatting", "already_connected");
    }

    await db.prepare(
      `INSERT INTO swipes (swiper_id, target_id, liked, create_date) VALUES (?, ?, ?, ?)
       ON CONFLICT (swiper_id, target_id) DO UPDATE SET liked = excluded.liked, create_date = excluded.create_date`,
    )
      .bind(me.id, targetId, like ? 1 : 0, nowIso())
      .run();

    if (!like) return json({ match: false });

    const theyLikeMe = await db
      .prepare("SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND liked = 1")
      .bind(targetId, me.id)
      .first();
    if (!theyLikeMe) return json({ match: false });

    // Both swiped right: it's a match
    const chatId = await createChat(db, me.id, targetId, "match");
    const [mine, theirs] = await Promise.all([personCard(db, me.id), personCard(db, targetId)]);
    ctx.waitUntil(sendPush(env, targetId, { kind: "match", name: mine?.username ?? "" }, { chat_id: chatId }));
    return json({ match: true, chat_id: chatId, user: theirs });
  }

  // POST /api/chat-requests  { to_id }  – "Request to chat" from a profile
  if (route("POST", /^\/api\/chat-requests$/)) {
    const me = await requireAdultUser(db, user);
    await rateLimit(env.WRITE_LIMITER, `write:${me.id}`);
    const toId = parseId((await readJson(request)).to_id);
    await requireReachable(db, me.id, toId);

    const chat = await activeChatBetween(db, me.id, toId);
    if (chat) return json({ status: "active", chat_id: chat.id });
    if (await isMutualFollow(db, me.id, toId)) return json({ status: "can_message" });

    const pending = await db
      .prepare(
        `SELECT id, from_id FROM chat_requests WHERE status = 'pending'
         AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) LIMIT 1`,
      )
      .bind(me.id, toId, toId, me.id)
      .first();
    if (pending?.from_id === me.id) return json({ status: "requested" });
    if (pending) {
      // They already asked me: asking back means yes
      const chatId = await createChat(db, me.id, toId, "request");
      const mine = await personCard(db, me.id);
      ctx.waitUntil(sendPush(env, toId, { kind: "accepted", name: mine?.username ?? "" }, { chat_id: chatId }));
      return json({ status: "active", chat_id: chatId });
    }

    // Declined recently: look like it worked, but don't bother them again
    const declined = await db
      .prepare(
        `SELECT 1 FROM chat_requests WHERE from_id = ? AND to_id = ? AND status = 'declined'
         AND respond_date >= ? LIMIT 1`,
      )
      .bind(me.id, toId, daysAgoIso(DECLINE_QUIET_DAYS))
      .first();
    if (declined) return json({ status: "requested" });

    await db.prepare(
      "INSERT INTO chat_requests (from_id, to_id, status, create_date) VALUES (?, ?, 'pending', ?)",
    )
      .bind(me.id, toId, nowIso())
      .run();
    const mine = await personCard(db, me.id);
    ctx.waitUntil(sendPush(env, toId, { kind: "request", name: mine?.username ?? "" }, { screen: "requests" }));
    return json({ status: "requested" }, 201);
  }

  // GET /api/chat-requests  – Requests waiting for my answer
  if (route("GET", /^\/api\/chat-requests$/)) {
    const me = await requireAdultUser(db, user);
    const { results } = await db
      .prepare(
        `SELECT r.id, r.create_date, up.id AS user_id, up.username, up.first_name, up.profile_photo
         FROM chat_requests r
         JOIN user_profile up ON up.id = r.from_id
         WHERE r.to_id = ? AND r.status = 'pending' AND ${NOT_BLOCKED_SQL("r.from_id")}
         ORDER BY r.create_date DESC`,
      )
      .bind(me.id, me.id, me.id)
      .all();
    return json(results.map((r) => ({ ...r, profile_photo: toImageUrl(r.profile_photo) })));
  }

  // PUT /api/chat-requests/:id  { accept }  – Accept (opens a chat) or decline
  if ((match = route("PUT", /^\/api\/chat-requests\/([^/]+)$/))) {
    const me = await requireAdultUser(db, user);
    const requestId = parseId(match[1]);
    const { accept } = await readJson(request);
    const row = await db
      .prepare("SELECT * FROM chat_requests WHERE id = ? AND to_id = ? AND status = 'pending'")
      .bind(requestId, me.id)
      .first();
    if (!row) return json({ error: "Request not found" }, 404);

    if (accept !== true) {
      await db.prepare("UPDATE chat_requests SET status = 'declined', respond_date = ? WHERE id = ?")
        .bind(nowIso(), requestId)
        .run();
      return json({ status: "declined" });
    }
    await requireReachable(db, me.id, row.from_id);
    const chatId = await createChat(db, me.id, row.from_id, "request");
    const mine = await personCard(db, me.id);
    ctx.waitUntil(sendPush(env, row.from_id, { kind: "accepted", name: mine?.username ?? "" }, { chat_id: chatId }));
    return json({ status: "active", chat_id: chatId });
  }

  // GET /api/chats  – My active chats, newest activity first
  if (route("GET", /^\/api\/chats$/)) {
    const me = await requireAdultUser(db, user);
    const { results } = await db
      .prepare(
        `SELECT c.id, c.source, c.created_at, c.expires_at,
                up.id AS user_id, up.username, up.first_name, up.profile_photo,
                m.body AS last_body, m.sender_id AS last_sender_id, m.create_date AS last_date,
                (SELECT COUNT(*) FROM messages x
                  WHERE x.chat_id = c.id AND x.sender_id != ?
                    AND x.id > COALESCE((SELECT last_read_id FROM chat_reads
                                         WHERE chat_id = c.id AND user_id = ?), 0)) AS unread
         FROM chats c
         JOIN user_profile up ON up.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
         LEFT JOIN messages m ON m.id = (SELECT MAX(id) FROM messages WHERE chat_id = c.id)
         WHERE (c.user_a = ? OR c.user_b = ?) AND c.expires_at > ?
           AND ${NOT_BLOCKED_SQL("up.id")}
         ORDER BY COALESCE(m.create_date, c.created_at) DESC`,
      )
      .bind(me.id, me.id, me.id, me.id, me.id, nowIso(), me.id, me.id)
      .all();
    return json(results.map((r) => ({ ...r, profile_photo: toImageUrl(r.profile_photo) })));
  }

  // POST /api/chats  { user_id }  – Start a chat with someone who follows you back
  if (route("POST", /^\/api\/chats$/)) {
    const me = await requireAdultUser(db, user);
    const otherId = parseId((await readJson(request)).user_id);
    await requireReachable(db, me.id, otherId);
    const existing = await activeChatBetween(db, me.id, otherId);
    if (existing) return json({ chat_id: existing.id });
    if (!(await isMutualFollow(db, me.id, otherId))) {
      throw new HttpError(403, "You need to connect first", "not_connected");
    }
    return json({ chat_id: await createChat(db, me.id, otherId, "follow") }, 201);
  }

  // Routes for one chat: check I'm in it and it hasn't ended
  const chatRoute =
    route("GET", /^\/api\/chats\/([^/]+)$/) ||
    route("GET", /^\/api\/chats\/([^/]+)\/messages$/) ||
    route("POST", /^\/api\/chats\/([^/]+)\/messages$/) ||
    route("PUT", /^\/api\/chats\/([^/]+)\/read$/) ||
    route("DELETE", /^\/api\/chats\/([^/]+)$/) ||
    route("GET", /^\/api\/chats\/([^/]+)\/ws$/);
  if (!chatRoute) return handlePushToken({ request, env, user, route });

  const me = await requireAdultUser(db, user);
  const chatId = parseId(chatRoute[1]);
  const chat = await db
    .prepare("SELECT * FROM chats WHERE id = ? AND (user_a = ? OR user_b = ?)")
    .bind(chatId, me.id, me.id)
    .first();
  const otherId = chat ? (chat.user_a === me.id ? chat.user_b : chat.user_a) : null;
  if (!chat || chat.expires_at <= nowIso() || (await isBlockedEitherWay(db, me.id, otherId))) {
    throw new HttpError(410, "This chat has ended", "chat_ended");
  }

  // GET /api/chats/:id  – Chat info (other person, when it ends)
  if (method === "GET" && /^\/api\/chats\/[^/]+$/.test(new URL(request.url).pathname)) {
    return json({
      id: chat.id,
      source: chat.source,
      created_at: chat.created_at,
      expires_at: chat.expires_at,
      user: await personCard(db, otherId),
    });
  }

  // GET /api/chats/:id/ws  – Live updates (WebSocket to the chat's room)
  if (request.url.includes("/ws")) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ error: "Expected a WebSocket" }, 426);
    }
    const room = env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(String(chatId)));
    return room.fetch(`https://chat-room/connect?user=${me.id}`, request);
  }

  // GET /api/chats/:id/messages?before=  – 50 at a time, oldest first
  if (method === "GET") {
    const before = searchParams.get("before") ? parseId(searchParams.get("before")) : null;
    const { results } = await db
      .prepare(
        `SELECT id, sender_id, body, create_date FROM messages
         WHERE chat_id = ? AND (? IS NULL OR id < ?)
         ORDER BY id DESC LIMIT 50`,
      )
      .bind(chatId, before, before)
      .all();
    return json(results.reverse());
  }

  // POST /api/chats/:id/messages  { body }
  if (method === "POST") {
    await rateLimit(env.SEARCH_LIMITER, `search:${me.id}`);
    const { body } = await readJson(request);
    const text = limitText(typeof body === "string" ? body.trim() : "", MESSAGE_MAX, "body");
    if (!text) return json({ error: "Empty message" }, 400);
    const createDate = nowIso();
    const result = await db
      .prepare("INSERT INTO messages (chat_id, sender_id, body, create_date) VALUES (?, ?, ?, ?)")
      .bind(chatId, me.id, text, createDate)
      .run();
    const message = { id: result.meta.last_row_id, sender_id: me.id, body: text, create_date: createDate };
    // My own message counts as read
    await db.prepare(
      `INSERT INTO chat_reads (chat_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`,
    )
      .bind(chatId, me.id, message.id)
      .run();
    const mine = await personCard(db, me.id);
    ctx.waitUntil(
      Promise.all([
        broadcast(env, chatId, { type: "message", message }),
        sendPush(
          env,
          otherId,
          { title: mine?.username ?? "", body: text.length > 120 ? `${text.slice(0, 117)}…` : text },
          { chat_id: chatId },
        ),
      ]),
    );
    return json(message, 201);
  }

  // PUT /api/chats/:id/read  { message_id }
  if (method === "PUT") {
    const messageId = parseId((await readJson(request)).message_id);
    await db.prepare(
      `INSERT INTO chat_reads (chat_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`,
    )
      .bind(chatId, me.id, messageId)
      .run();
    return json({ success: true });
  }

  // DELETE /api/chats/:id  – End the chat now (the connection ends too)
  await db.batch(endConnectionStatements(db, me.id, otherId));
  ctx.waitUntil(broadcast(env, chatId, { type: "ended" }));
  return json({ success: true });
}

/** PUT / DELETE /api/push-token  { token, platform, language } */
async function handlePushToken({ request, env, user, route }) {
  if (route("PUT", /^\/api\/push-token$/)) {
    requireUser(user);
    const { token, platform, language } = await readJson(request);
    if (typeof token !== "string" || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
      return json({ error: "Invalid push token" }, 400);
    }
    await env.DB.prepare(
      `INSERT INTO push_tokens (token, user_id, platform, language, update_date) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform,
         language = excluded.language, update_date = excluded.update_date`,
    )
      .bind(token, user.userId, String(platform ?? "").slice(0, 10), String(language ?? "en").slice(0, 5), nowIso())
      .run();
    return json({ success: true });
  }
  if (route("DELETE", /^\/api\/push-token$/)) {
    requireUser(user);
    const { token } = await readJson(request);
    await env.DB.prepare("DELETE FROM push_tokens WHERE token = ? AND user_id = ?")
      .bind(String(token ?? ""), user.userId)
      .run();
    return json({ success: true });
  }
  return null;
}

// ── Scheduled clean-up (cron, every hour) ────────

/** Deletes ended chats with their messages, and lets those pairs meet again. */
export async function cleanUpExpiredChats(env) {
  const db = env.DB;
  const now = nowIso();
  const { results: ended } = await db
    .prepare("SELECT user_a, user_b FROM chats WHERE expires_at <= ?")
    .bind(now)
    .all();
  const statements = ended.flatMap((c) => endConnectionStatements(db, c.user_a, c.user_b));
  // Old passes and answered requests aren't needed any more
  statements.push(
    db.prepare("DELETE FROM swipes WHERE liked = 0 AND create_date < ?").bind(daysAgoIso(30)),
    db.prepare("DELETE FROM chat_requests WHERE status != 'pending' AND respond_date < ?").bind(daysAgoIso(30)),
  );
  // D1 batches are limited in size, so run in chunks
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }
  return ended.length;
}

// ── Live chat room (one Durable Object per chat) ─

/**
 * Keeps the open WebSockets of one chat and passes new messages to them.
 * Uses hibernation, so an idle room costs nothing.
 */
export class ChatRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/broadcast") {
      const text = await request.text();
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(text);
        } catch {
          // closed socket – ignore
        }
      }
      if (JSON.parse(text).type === "ended") {
        for (const socket of this.ctx.getWebSockets()) socket.close(1000, "Chat ended");
      }
      return new Response("ok");
    }
    return new Response("Not found", { status: 404 });
  }

  // Keep-alive from the app
  webSocketMessage(socket, message) {
    if (message === "ping") socket.send("pong");
  }

  webSocketClose(socket, code) {
    try {
      socket.close(code, "Closing");
    } catch {
      // already closed
    }
  }
}
