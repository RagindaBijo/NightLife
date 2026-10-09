// Profiles: complete-profile rule, hidden profiles, search, posts, follower lists
module.exports = async ({ call, check, sleep, uploadImage, registerUser, registerVenue, runId }) => {
  const A = await registerUser("pa");
  const B = await registerUser("pb");
  const C = await registerUser("pc");
  const incomplete = await registerUser("pi", { complete: false }); // no profile photo
  const V = await registerVenue("pv");

  // ── Complete profile: photo, names and username ──
  check("owner told the profile is incomplete", (await call(`/api/user/${incomplete.userId}`, { token: incomplete.token })).data.profile_complete, false);
  check("owner of a complete profile", (await call(`/api/user/${A.userId}`, { token: A.token })).data.profile_complete, true);
  check("incomplete profile invisible to others", (await call(`/api/user/${incomplete.userId}`, { token: A.token })).status, 404);
  check("…and not in search", (await call(`/api/users/search?q=pi_${runId}`, { token: A.token })).data.length, 0);
  const photo = await uploadImage(incomplete.token, "user");
  check("incomplete profile can't post", (await call("/api/posts", { method: "POST", token: incomplete.token, body: { user_id: incomplete.userId, photo_id: photo } })).data.code, "profile_incomplete");
  check("incomplete profile can't use Discover", (await call("/api/discover", { token: incomplete.token })).data.code, "profile_incomplete");
  check("/me/social says so", (await call("/api/me/social", { token: incomplete.token })).data.profile_complete, false);
  // Adding the photo (and the preferences) completes it
  await call(`/api/user/${incomplete.userId}`, { method: "PUT", token: incomplete.token, body: { profile_photo: photo, music: ["pop", "rock", "jazz"], venue_types: ["bar", "pub", "lounge"] } });
  check("after adding photo + preferences: visible", (await call(`/api/user/${incomplete.userId}`, { token: A.token })).status, 200);
  check("…in search", (await call(`/api/users/search?q=pi_${runId}`, { token: A.token })).data.length, 1);
  // Removing a name hides the profile and its posts again
  const post = (await call("/api/posts", { method: "POST", token: incomplete.token, body: { user_id: incomplete.userId, photo_id: await uploadImage(incomplete.token), post_text: "hi" } })).data;
  check("complete profile can post", typeof post.id, "number");
  await call(`/api/user/${incomplete.userId}`, { method: "PUT", token: incomplete.token, body: { last_name: "" } });
  check("emptied last name → posts hidden from the feed", (await call("/api/posts", { token: A.token })).data.some((p) => p.id === post.id), false);
  const venuePost = (await call("/api/posts", { method: "POST", token: V.token, body: { user_id: V.userId, photo_id: await uploadImage(V.token), post_text: "Tonight!" } })).data;
  check("venue posts aren't affected by this rule", (await call("/api/posts", { token: A.token })).data.some((p) => p.id === venuePost.id), true);

  // ── Music and place preferences (3–10 each, part of a complete profile) ──
  const P = await registerUser("pp", { complete: false });
  const setPrefs = (body) => call(`/api/user/${P.userId}`, { method: "PUT", token: P.token, body });
  await setPrefs({ profile_photo: await uploadImage(P.token) });
  check("photo but no preferences → still incomplete", (await call(`/api/user/${P.userId}`, { token: P.token })).data.profile_complete, false);
  check("fewer than 3 → rejected", (await setPrefs({ music: ["techno", "house"], venue_types: ["bar", "pub", "lounge"] })).data.code, "preferences_count");
  check("unknown key → rejected", (await setPrefs({ music: ["techno", "house", "polka"], venue_types: ["bar", "pub", "lounge"] })).data.code, "invalid_preferences");
  check("more than 10 → rejected", (await setPrefs({ music: ["techno", "house", "deep_house", "electronic", "drum_and_bass", "trance", "hip_hop", "rnb", "pop", "rock", "indie"] })).data.code, "preferences_count");
  check("3 + 3 saved", (await setPrefs({ music: ["techno", "rnb", "jazz"], venue_types: ["rooftop", "bar", "lounge"] })).status, 200);
  const withPrefs = (await call(`/api/user/${P.userId}`, { token: A.token })).data;
  check("now complete and visible", withPrefs.id, P.userId);
  check("preferences are on the profile", [withPrefs.music.sort(), withPrefs.venue_types.sort()], [["jazz", "rnb", "techno"], ["bar", "lounge", "rooftop"]]);
  check("saving replaces the old list", ((await setPrefs({ music: ["pop", "rock", "indie"] })), (await call(`/api/user/${P.userId}`, { token: P.token })).data.music.sort()), ["indie", "pop", "rock"]);

  // ── People search ──
  const search = async (q, who = A) => (await call(`/api/users/search?q=${encodeURIComponent(q)}`, { token: who.token })).data;
  check("needs login", (await call("/api/users/search?q=test")).status, 401);
  check("1 character → nothing", await search("p"), []);
  check("by username, any case", (await search(`PB_${runId}`)).map((u) => u.username), [`pb_${runId}`]);
  check("by first name", (await search("PC")).some((u) => u.username === `pc_${runId}`), true);
  check("never yourself", (await search(`pa_${runId}`)).length, 0);
  check("venues not in people search", (await search(`pv_${runId}`)).length, 0);
  check("% is matched literally", (await search("%%")).length, 0);
  check("no private fields", Object.keys((await search(`pb_${runId}`))[0]).sort(), ["first_name", "id", "is_following", "last_name", "profile_photo", "username"]);

  // ── Hidden profile ──
  check("B hides profile", (await call(`/api/user/${B.userId}`, { method: "PUT", token: B.token, body: { is_hidden: true } })).status, 200);
  check("hidden: not in search", (await search(`pb_${runId}`)).length, 0);
  check("only the owner sees the flag", ["is_hidden" in (await call(`/api/user/${B.userId}`, { token: A.token })).data, (await call(`/api/user/${B.userId}`, { token: B.token })).data.is_hidden], [false, true]);
  check("bad value rejected", (await call(`/api/user/${B.userId}`, { method: "PUT", token: B.token, body: { is_hidden: "yes" } })).status, 400);
  await call(`/api/user/${B.userId}`, { method: "PUT", token: B.token, body: { is_hidden: false } });
  check("unhidden: back in search", (await search(`pb_${runId}`)).length, 1);

  // ── One person's posts ──
  for (let i = 0; i < 2; i++) {
    await call("/api/posts", { method: "POST", token: B.token, body: { user_id: B.userId, photo_id: await uploadImage(B.token), post_text: "x" } });
  }
  const postsOfB = (await call(`/api/posts?user_id=${B.userId}`, { token: A.token })).data;
  check("?user_id= only that person's posts", postsOfB.map((p) => p.user_id), [B.userId, B.userId]);
  check("posts include user_type", postsOfB[0].user_type, 1);
  // ── Photo shape: kept between 4:5 and 1.91:1 ──
  const shaped = async (photo_ratio) => {
    const { id } = (await call("/api/posts", { method: "POST", token: B.token, body: { user_id: B.userId, photo_id: await uploadImage(B.token), photo_ratio } })).data;
    return (await call(`/api/posts?user_id=${B.userId}`, { token: A.token })).data.find((p) => p.id === id).photo_ratio;
  };
  check("landscape shape saved", await shaped(4 / 3), 1.333);
  check("very tall photo → 4:5", await shaped(9 / 16), 0.8);
  check("panorama → 1.91", await shaped(3), 1.91);
  check("no shape → null (shown as 4:5)", postsOfB[0].photo_ratio, null);
  check("bad shape → invalid_photo_ratio", (await call("/api/posts", { method: "POST", token: B.token, body: { user_id: B.userId, photo_id: await uploadImage(B.token), photo_ratio: "wide" } })).data.code, "invalid_photo_ratio");
  check("caption over 2200 → too_long", (await call("/api/posts", { method: "POST", token: B.token, body: { user_id: B.userId, photo_id: await uploadImage(B.token), post_text: "x".repeat(2201) } })).data.code, "too_long");

  // ── Follower lists ──
  const follow = (who, target) => call(`/api/users/${target.userId}/follow`, { method: "PUT", token: who.token });
  const answer = (who, requester, accept) =>
    call(`/api/follow-requests/${requester.userId}`, { method: "PUT", token: who.token, body: { accept } });
  await follow(B, A);
  await answer(A, B, true);
  await sleep(1100); // follows are timestamped to the second
  await follow(C, A);
  await answer(A, C, true);
  await follow(A, B); // follow back: B already follows A
  const list = async (who, of, kind) => (await call(`/api/users/${of.userId}/${kind}`, { token: who.token })).data;
  const followers = await list(A, A, "followers");
  check("followers, newest first", followers.map((p) => p.username), [`pc_${runId}`, `pb_${runId}`]);
  check("…with who A follows back", followers.map((p) => p.is_following), [false, true]);
  check("following", (await list(A, A, "following")).map((p) => p.username), [`pb_${runId}`]);
  check("viewer marked is_me", (await list(B, A, "followers")).find((p) => p.username === `pb_${runId}`).is_me, true);
  await call(`/api/users/${A.userId}/block`, { method: "PUT", token: C.token });
  check("blocked person left out", (await list(A, A, "followers")).map((p) => p.username), [`pb_${runId}`]);
  check("blocked user can't open the blocker's lists", (await call(`/api/users/${C.userId}/followers`, { token: A.token })).status, 404);
};
