// Follow requests (accept / decline / take back, follow back, venues) and notifications
module.exports = async ({ call, check, sleep, uploadImage, registerUser, registerVenue }) => {
  const X = await registerUser("fx");
  const Y = await registerUser("fy");
  const Z = await registerUser("fz");
  const V = await registerVenue("fv");

  const follow = (who, target) => call(`/api/users/${target.userId}/follow`, { method: "PUT", token: who.token });
  const unfollow = (who, target) => call(`/api/users/${target.userId}/follow`, { method: "DELETE", token: who.token });
  const answer = (who, requester, accept) =>
    call(`/api/follow-requests/${requester.userId}`, { method: "PUT", token: who.token, body: { accept } });
  const profile = async (who, of) => (await call(`/api/user/${of.userId}`, { token: who.token })).data;
  const notifications = async (who) => (await call("/api/notifications", { token: who.token })).data;
  const unread = async (who) => (await call("/api/notifications/unread", { token: who.token })).data.count;

  // ── Requests ──
  check("following a person sends a request", (await follow(X, Y)).data.status, "requested");
  const xSeesY = await profile(X, Y);
  check("…shown as requested, not counted yet", [xSeesY.follow_status, xSeesY.followers_count], ["requested", 0]);
  check("the other person sees the request on the profile", (await profile(Y, X)).requested_you, true);
  const first = (await notifications(Y)).items[0];
  check("request in notifications", [first.type, first.user.id, first.unread], ["follow_request", X.userId, true]);
  check("unread count", await unread(Y), 1);

  check("decline", (await answer(Y, X, false)).data.accepted, false);
  check("…nothing left", [(await profile(X, Y)).follow_status, (await notifications(Y)).items.length], ["none", 0]);
  check("answering again → request_not_found", (await answer(Y, X, true)).data.code, "request_not_found");

  await follow(X, Y);
  check("take a request back", (await unfollow(X, Y)).data.status, "none");
  check("…gone from their notifications", (await notifications(Y)).items.length, 0);

  // ── Accept, then follow back ──
  await follow(X, Y);
  const accepted = (await answer(Y, X, true)).data;
  check("accept", [accepted.accepted, accepted.followers_count, accepted.mutual], [true, 1, false]);
  const ySeesX = await profile(Y, X);
  check("accepted person shows 'follow back'", [ySeesX.follows_you, ySeesX.follow_status], [true, "none"]);
  check("follow back needs no request", (await follow(Y, X)).data.status, "following");
  check("X is told: accepted + followed", (await notifications(X)).items.map((n) => n.type).sort(), ["follow", "follow_accepted"]);
  check("follow notification offers nothing more (already following back)", (await notifications(X)).items.find((n) => n.type === "follow").is_following, true);

  // Accepting someone you already follow makes it mutual
  await follow(Z, Y);
  await follow(Y, Z);
  await answer(Z, Y, true); // Y now follows Z
  check("accepting someone you follow → mutual", (await answer(Y, Z, true)).data.mutual, true);

  // ── Venues are followed straight away ──
  check("venue: no request", (await follow(X, V)).data.status, "following");
  check("venue gets a follow notification", (await notifications(V)).items[0].type, "follow");

  // ── Likes ──
  const post = (await call("/api/posts", { method: "POST", token: Y.token, body: { user_id: Y.userId, photo_id: await uploadImage(Y.token) } })).data.id;
  await call(`/api/posts/${post}/like`, { method: "PUT", token: Y.token }); // own like: no notification
  await call(`/api/posts/${post}/like`, { method: "PUT", token: X.token });
  const likes = (await notifications(Y)).items.filter((n) => n.type === "like");
  check("like notification with the post", [likes.length, likes[0].user.id, likes[0].post_id, typeof likes[0].post_image], [1, X.userId, post, "string"]);
  await call(`/api/posts/${post}/like`, { method: "DELETE", token: X.token });
  check("unlike removes it", (await notifications(Y)).items.some((n) => n.type === "like"), false);

  // ── Seen ──
  await call("/api/notifications/seen", { method: "PUT", token: Y.token });
  check("all read after opening", await unread(Y), 0);
  await sleep(1100); // timestamps are to the second
  await call(`/api/posts/${post}/like`, { method: "PUT", token: Z.token });
  check("a new one is unread again", await unread(Y), 1);

  // ── Blocking hides them ──
  await call(`/api/users/${Z.userId}/block`, { method: "PUT", token: Y.token });
  check("blocked person's notifications hidden", (await notifications(Y)).items.some((n) => n.user.id === Z.userId), false);
};
