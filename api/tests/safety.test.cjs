// 403 vs 401, length limits, reports, blocking
module.exports = async ({ call, check, uploadImage, registerUser, registerVenue }) => {
  const A = await registerUser("sa");
  const B = await registerUser("sb");
  const V = await registerVenue("sv");

  // ── "Not allowed" is 403 (401 would log the app out) ──
  check("editing someone else → 403", (await call(`/api/user/${B.userId}`, { method: "PUT", token: A.token, body: { bio_text: "x" } })).status, 403);
  check("user creating an event → 403", (await call("/api/events", { method: "POST", token: A.token, body: {} })).status, 403);
  check("venue editing a user profile → 403", (await call(`/api/user/${V.userId}`, { method: "PUT", token: V.token, body: { bio_text: "x" } })).status, 403);
  check("no token → 401", (await call("/api/events", { method: "POST", body: {} })).status, 401);

  // ── Length and format limits ──
  check("bio over 300 → too_long", (await call(`/api/user/${A.userId}`, { method: "PUT", token: A.token, body: { bio_text: "x".repeat(301) } })).data.code, "too_long");
  check("bio of 300 is fine", (await call(`/api/user/${A.userId}`, { method: "PUT", token: A.token, body: { bio_text: "x".repeat(300) } })).status, 200);
  check("venue visibility must be 0/1", (await call(`/api/venue/${V.userId}`, { method: "PUT", token: V.token, body: { public_status: 5 } })).status, 400);
  check("map position must be real", (await call(`/api/venue/${V.userId}`, { method: "PUT", token: V.token, body: { lat_long: "999,1" } })).status, 400);
  check("real map position is fine", (await call(`/api/venue/${V.userId}`, { method: "PUT", token: V.token, body: { lat_long: "41.69,44.80" } })).status, 200);

  // ── Reports (only reasons worth reviewing; blocking covers the rest) ──
  const postB = (await call("/api/posts", { method: "POST", token: B.token, body: { user_id: B.userId, photo_id: await uploadImage(B.token), post_text: "hello" } })).data;
  const report = (body, token = A.token) => call("/api/reports", { method: "POST", token, body });
  check("report a post", (await report({ target_type: "post", target_id: postB.id, reason: "sexual_content" })).status, 201);
  check("reporting twice keeps one", (await report({ target_type: "post", target_id: postB.id, reason: "other" })).status, 201);
  check("report a user with details", (await report({ target_type: "user", target_id: B.userId, reason: "other", details: "rude" })).status, 201);
  check("report a venue", (await report({ target_type: "venue", target_id: V.userId, reason: "fake_account" })).status, 201);
  for (const removed of ["spam", "hate_speech", "violence", "scam", "underage", "harassment"]) {
    check(`removed reason "${removed}" rejected`, (await report({ target_type: "user", target_id: B.userId, reason: removed })).data.code, "invalid_reason");
  }
  check("venue reported as a user → 404", (await report({ target_type: "user", target_id: V.userId, reason: "other" })).status, 404);
  check("can't report yourself", (await report({ target_type: "user", target_id: A.userId, reason: "other" })).status, 400);
  check("can't report your own post", (await report({ target_type: "post", target_id: postB.id, reason: "other" }, B.token)).status, 400);
  check("details over 500 → too_long", (await report({ target_type: "user", target_id: B.userId, reason: "other", details: "x".repeat(501) })).data.code, "too_long");

  // ── Blocking ──
  await call(`/api/users/${B.userId}/follow`, { method: "PUT", token: A.token });
  await call(`/api/follow-requests/${A.userId}`, { method: "PUT", token: B.token, body: { accept: true } });
  await call(`/api/users/${A.userId}/follow`, { method: "PUT", token: B.token });  const feedHas = async (token, authorId) => (await call("/api/posts", { token })).data.some((p) => p.user_id === authorId);
  check("before: A sees B's posts", await feedHas(A.token, B.userId), true);
  check("block B", (await call(`/api/users/${B.userId}/block`, { method: "PUT", token: A.token })).data, { is_blocked: true });
  check("A no longer sees B's posts", await feedHas(A.token, B.userId), false);
  check("search hides both ways", [(await call(`/api/users/search?q=${B.username}`, { token: A.token })).data.length, (await call(`/api/users/search?q=${A.username}`, { token: B.token })).data.length], [0, 0]);
  check("B sees A as not found", (await call(`/api/user/${A.userId}`, { token: B.token })).status, 404);
  const aViewsB = (await call(`/api/user/${B.userId}`, { token: A.token })).data;
  check("A sees 'blocked', follows removed", [aViewsB.is_blocked, aViewsB.is_following, aViewsB.followers_count], [true, false, 0]);
  check("B can't follow A", (await call(`/api/users/${A.userId}/follow`, { method: "PUT", token: B.token })).data.code, "blocked");
  check("blocked list", (await call("/api/blocks", { token: A.token })).data.map((p) => p.username), [B.username]);
  check("can't block yourself", (await call(`/api/users/${A.userId}/block`, { method: "PUT", token: A.token })).status, 400);
  check("unblock", (await call(`/api/users/${B.userId}/block`, { method: "DELETE", token: A.token })).data, { is_blocked: false });
  check("after unblock: posts visible again", await feedHas(A.token, B.userId), true);
};
