// Connections and chat: 18+ gate, Discover, matches, requests, chats, live updates, expiry, unread badge
module.exports = async ({ BASE, call, check, sql, query, sleep, registerUser, registerVenue }) => {
  const yearsAgo = (y) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - y);
    return d.toISOString().slice(0, 10);
  };
  const A = await registerUser("ca");
  const B = await registerUser("cb");
  const C = await registerUser("cc");
  const F = await registerUser("cf");
  const D = await registerUser("cd", { birth_date: yearsAgo(16) }); // 16 years old
  const E = await registerUser("ce"); // becomes an "old" account without a birth date
  const V = await registerVenue("cv");
  sql(`UPDATE login_data SET birth_date = NULL WHERE id = ${E.userId}`);

  // ── Who may use it ──
  check("adult with complete profile", (await call("/api/me/social", { token: A.token })).data.is_adult, true);
  check("16-year-old: not adult", (await call("/api/me/social", { token: D.token })).data.is_adult, false);
  check("venue: not a person", (await call("/api/me/social", { token: V.token })).data.is_user, false);
  check("16-year-old → under_18", (await call("/api/discover", { token: D.token })).data.code, "under_18");
  check("venue → users_only", (await call("/api/discover", { token: V.token })).data.code, "users_only");
  check("old account → birth_date_required", (await call("/api/discover", { token: E.token })).data.code, "birth_date_required");
  check("old account sets birth date once", (await call("/api/me/birth-date", { method: "PUT", token: E.token, body: { birth_date: "1990-02-02" } })).data, { has_birth_date: true, is_adult: true });
  check("…not twice", (await call("/api/me/birth-date", { method: "PUT", token: E.token, body: { birth_date: "1980-02-02" } })).data.code, "birth_date_set");

  // ── Discover ──
  await call(`/api/venues/${V.userId}/favorite`, { method: "PUT", token: A.token });
  await call(`/api/venues/${V.userId}/favorite`, { method: "PUT", token: C.token });
  const deck = (await call("/api/discover", { token: A.token })).data;
  const ids = deck.map((p) => p.id);
  check("adults B and C appear", [ids.includes(B.userId), ids.includes(C.userId)], [true, true]);
  check("not the 16-year-old, venue or yourself", [ids.includes(D.userId), ids.includes(V.userId), ids.includes(A.userId)], [false, false, false]);
  check("shared venue ranks first", deck[0].id, C.userId);
  check("card: shared venue + age", [deck[0].shared_venues.map((v) => v.title), typeof deck[0].age], [["Club CV"], "number"]);
  check("card: only public fields", Object.keys(deck[0]).sort(), ["age", "bio", "first_name", "id", "music", "photos", "profile_photo", "shared_events", "shared_music", "shared_venue_types", "shared_venues", "username", "venue_types", "vibe"]);
  check("same tastes → vibe 100", deck[0].vibe, 100);
  await call(`/api/user/${B.userId}`, { method: "PUT", token: B.token, body: { is_hidden: true } });
  check("hidden profile not in Discover", (await call("/api/discover", { token: A.token })).data.some((p) => p.id === B.userId), false);
  await call(`/api/user/${B.userId}`, { method: "PUT", token: B.token, body: { is_hidden: false } });

  // ── Swipes and matches ──
  const swipe = (who, target, like) => call("/api/discover/swipe", { method: "POST", token: who.token, body: { target_id: target.userId, like } });
  check("A likes B: no match yet", (await swipe(A, B, true)).data, { match: false });
  check("liked person leaves the deck", (await call("/api/discover", { token: A.token })).data.some((p) => p.id === B.userId), false);
  const m = (await swipe(B, A, true)).data;
  check("B likes A back: match", [m.match, typeof m.chat_id, m.user?.id], [true, "number", A.userId]);
  const chatAB = m.chat_id;
  await swipe(A, C, false);
  check("passed person hidden", (await call("/api/discover", { token: A.token })).data.some((p) => p.id === C.userId), false);
  check("can't swipe on a 16-year-old", (await swipe(A, D, true)).data.code, "not_available");

  // ── Chat requests ──
  const statusOf = async (viewer, other) => (await call(`/api/user/${other.userId}`, { token: viewer.token })).data;
  check("C → E request", (await call("/api/chat-requests", { method: "POST", token: C.token, body: { to_id: E.userId } })).data.status, "requested");
  check("C sees 'requested'", (await statusOf(C, E)).chat_status, "requested");
  const incoming = await statusOf(E, C);
  check("E sees 'incoming'", incoming.chat_status, "incoming");
  check("E's requests list", (await call("/api/chat-requests", { token: E.token })).data.map((r) => r.user_id), [C.userId]);
  check("unread badge counts the request", (await call("/api/chats/unread", { token: E.token })).data, { messages: 0, requests: 1 });
  const accepted = (await call(`/api/chat-requests/${incoming.request_id}`, { method: "PUT", token: E.token, body: { accept: true } })).data;
  check("accept → chat", accepted.status, "active");
  check("both see 'active'", [(await statusOf(C, E)).chat_status, (await statusOf(E, C)).chat_status], ["active", "active"]);
  check("request to a 16-year-old → not_available", (await call("/api/chat-requests", { method: "POST", token: A.token, body: { to_id: D.userId } })).data.code, "not_available");
  check("16-year-old sees no chat button", (await statusOf(D, A)).chat_status, "unavailable");
  await call("/api/chat-requests", { method: "POST", token: F.token, body: { to_id: C.userId } });
  const fRequest = await statusOf(C, F);
  await call(`/api/chat-requests/${fRequest.request_id}`, { method: "PUT", token: C.token, body: { accept: false } });
  check("after a decline, asking again looks fine…", (await call("/api/chat-requests", { method: "POST", token: F.token, body: { to_id: C.userId } })).data.status, "requested");
  check("…but doesn't bother them", (await call("/api/chat-requests", { token: C.token })).data.length, 0);

  // ── Messages, live delivery, unread ──
  const live = [];
  const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/chats/${chatAB}/ws`, { headers: { Authorization: `Bearer ${B.token}` } });
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => live.push(JSON.parse(event.data));
  const sent = (await call(`/api/chats/${chatAB}/messages`, { method: "POST", token: A.token, body: { body: "  hey there  " } })).data;
  check("message saved (trimmed)", sent.body, "hey there");
  await sleep(500);
  check("delivered live over WebSocket", live.map((e) => e.message?.body), ["hey there"]);
  ws.close();
  check("history", (await call(`/api/chats/${chatAB}/messages`, { token: B.token })).data.map((x) => x.body), ["hey there"]);
  const unreadIn = async (who) => (await call("/api/chats", { token: who.token })).data.find((c) => c.id === chatAB)?.unread;
  check("B 1 unread, A 0", [await unreadIn(B), await unreadIn(A)], [1, 0]);
  check("badge total for B", (await call("/api/chats/unread", { token: B.token })).data, { messages: 1, requests: 0 });
  await call(`/api/chats/${chatAB}/read`, { method: "PUT", token: B.token, body: { message_id: sent.id } });
  check("after reading: 0", [await unreadIn(B), (await call("/api/chats/unread", { token: B.token })).data.messages], [0, 0]);
  check("badge is zero (not an error) for a venue", (await call("/api/chats/unread", { token: V.token })).data, { messages: 0, requests: 0 });
  check("outsiders can't read", (await call(`/api/chats/${chatAB}/messages`, { token: C.token })).status, 410);
  check("empty message rejected", (await call(`/api/chats/${chatAB}/messages`, { method: "POST", token: A.token, body: { body: "   " } })).status, 400);
  check("over 1000 characters → too_long", (await call(`/api/chats/${chatAB}/messages`, { method: "POST", token: A.token, body: { body: "x".repeat(1001) } })).data.code, "too_long");

  // ── Mutual follows ──
  check("not connected yet", (await call("/api/chats", { method: "POST", token: A.token, body: { user_id: F.userId } })).data.code, "not_connected");
  // A asks to follow F, F accepts, then F follows back
  await call(`/api/users/${F.userId}/follow`, { method: "PUT", token: A.token });
  await call(`/api/follow-requests/${A.userId}`, { method: "PUT", token: F.token, body: { accept: true } });
  await call(`/api/users/${A.userId}/follow`, { method: "PUT", token: F.token });
  check("mutual followers: can_message", (await statusOf(A, F)).chat_status, "can_message");
  const chatAF = (await call("/api/chats", { method: "POST", token: A.token, body: { user_id: F.userId } })).data.chat_id;
  check("start a chat directly", typeof chatAF, "number");

  // ── Expiry and the hourly clean-up ──
  sql(`UPDATE chats SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ${chatAF}`);
  check("expired → chat_ended", (await call(`/api/chats/${chatAF}/messages`, { token: A.token })).data.code, "chat_ended");
  check("gone from the list", (await call("/api/chats", { token: A.token })).data.some((c) => c.id === chatAF), false);
  await fetch(`${BASE}/__scheduled?cron=0+*+*+*+*`);
  await sleep(1000);
  check("clean-up job deleted it", query(`SELECT COUNT(*) AS n FROM chats WHERE id = ${chatAF}`)[0].n, 0);
  check("mutual followers can start again", typeof (await call("/api/chats", { method: "POST", token: A.token, body: { user_id: F.userId } })).data.chat_id, "number");

  // ── Ending and blocking ──
  check("end a chat", (await call(`/api/chats/${accepted.chat_id}`, { method: "DELETE", token: C.token })).status, 200);
  check("gone for the other person", (await call("/api/chats", { token: E.token })).data.length, 0);
  check("they can meet in Discover again", (await call("/api/discover", { token: C.token })).data.some((p) => p.id === E.userId), true);
  await call(`/api/users/${A.userId}/block`, { method: "PUT", token: B.token });
  check("blocking ends the match chat", (await call(`/api/chats/${chatAB}/messages`, { token: A.token })).status, 410);

  // ── Push tokens ──
  check("bad push token rejected", (await call("/api/push-token", { method: "PUT", token: A.token, body: { token: "nope" } })).status, 400);
  check("push token saved", (await call("/api/push-token", { method: "PUT", token: A.token, body: { token: "ExponentPushToken[test123]", platform: "ios", language: "ka" } })).status, 200);
};
