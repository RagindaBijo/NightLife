// Event start times, upcoming lists, going counts, venue totals
module.exports = async ({ call, check, sql, sleep, uploadImage, registerUser, registerVenue }) => {
  const A = await registerUser("ea");
  const B = await registerUser("eb");
  const V = await registerVenue("ev");

  const inHours = (h) => new Date(Date.now() + h * 3600000).toISOString();
  const newEvent = async (title, startsAt) =>
    call("/api/events", {
      method: "POST",
      token: V.token,
      body: { venue_id: V.userId, title, about: "x", photo_id: await uploadImage(V.token, "event"), starts_at: startsAt },
    });

  // ── Start times ──
  check("in the past → rejected", (await newEvent("Old", inHours(-48))).data.code, "starts_at_past");
  check("old text format → rejected", (await newEvent("Bad", "05-March: 8PM")).data.code, "invalid_starts_at");
  await newEvent("Later", inHours(72));
  await newEvent("Soon", inHours(3));
  const running = (await newEvent("Started an hour ago", inHours(-1))).data; // still on
  sql(`UPDATE events SET starts_at = '${inHours(-30)}' WHERE title = 'Later' AND venue_id = ${V.userId}`); // pretend it's over
  check("upcoming only, soonest first", (await call(`/api/events?venue_id=${V.userId}`, { token: A.token })).data.map((e) => e.title), ["Started an hour ago", "Soon"]);
  check("the venue sees past events too", (await call(`/api/events?venue_id=${V.userId}&include_past=1`, { token: V.token })).data.length, 3);
  check("others can't ask for past ones", (await call(`/api/events?venue_id=${V.userId}&include_past=1`, { token: A.token })).data.length, 2);
  check("event has starts_at", typeof (await call(`/api/events/${running.id}`, { token: A.token })).data.starts_at, "string");

  // ── Going count ──
  const going = async () => (await call(`/api/events/${running.id}`, { token: A.token })).data.going_count;
  check("0 going", await going(), 0);
  await call(`/api/events/${running.id}/interest`, { method: "PUT", token: A.token });
  await call(`/api/events/${running.id}/interest`, { method: "PUT", token: B.token });
  check("2 going", await going(), 2);
  check("count in lists too", (await call(`/api/events?venue_id=${V.userId}`, { token: A.token })).data.find((e) => e.id === running.id).going_count, 2);

  // ── Venue totals ──
  await call(`/api/venue/${V.userId}`, { token: A.token });
  await call(`/api/venue/${V.userId}`, { token: A.token }); // same person, same day → once
  await call(`/api/venue/${V.userId}`, { token: B.token });
  await call(`/api/venues/${V.userId}/favorite`, { method: "PUT", token: A.token });
  await sleep(500); // views are saved after the response
  check("the venue sees its totals", (await call(`/api/venue/${V.userId}`, { token: V.token })).data.stats, { views_total: 2, views_30d: 2, favorites: 1 });
  check("its own visits don't count", (await call(`/api/venue/${V.userId}`, { token: V.token })).data.stats.views_total, 2);
  check("visitors don't get the totals", "stats" in (await call(`/api/venue/${V.userId}`, { token: A.token })).data, false);
};
