// Sign-up, login, password rules, password change, token revocation, rate limits
module.exports = async ({ call, check, sql, registerUser, runId }) => {
  const good = {
    user_type: 1,
    email: `  Party.${runId}@Test.Local `,
    password: "Strong-pass9",
    username: `Party_${runId}`,
    first_name: "Nino",
    last_name: "Beridze",
    birth_date: "2000-05-17",
    accepted_terms: true,
  };
  const reg = (overrides) => call("/api/register", { method: "POST", body: { ...good, ...overrides } });

  // ── Sign-up rules ──
  check("username free before", (await call(`/api/username-available?username=Party_${runId}`)).data, { available: true, reason: null });
  check("username with a space is invalid", (await call("/api/username-available?username=a b")).data.reason, "invalid_username");
  check("terms required", (await reg({ accepted_terms: false })).data.code, "terms_required");
  check("weak: no uppercase", (await reg({ password: "weak-pass9" })).data.code, "weak_password");
  check("weak: 8 characters", (await reg({ password: "Strong-9" })).data.code, "weak_password");
  check("weak: no symbol", (await reg({ password: "Strongpass9" })).data.code, "weak_password");
  check("weak: no number", (await reg({ password: "Strong-pass" })).data.code, "weak_password");
  check("bad email", (await reg({ email: "not-an-email" })).data.code, "invalid_email");
  check("missing last name", (await reg({ last_name: " " })).data.code, "missing_fields");
  check("birth date required", (await reg({ birth_date: undefined })).data.code, "invalid_birth_date");
  check("impossible date", (await reg({ birth_date: "2001-02-30" })).data.code, "invalid_birth_date");
  const inYears = (y, days = 0) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - y);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  check("turns 13 tomorrow → too young", (await reg({ birth_date: inYears(13, 1) })).data.code, "too_young");

  const ok = await reg({});
  check("one-step sign-up", ok.status, 200);
  const profile = (await call(`/api/user/${ok.data.userId}`, { token: ok.data.token })).data;
  check("profile filled in the same call", [profile.username, profile.first_name, profile.last_name], [`Party_${runId}`, "Nino", "Beridze"]);
  check("birth date never in profile data", "birth_date" in profile, false);
  check("same username, other case", (await reg({ email: `x${runId}@test.local`, username: `party_${runId}` })).data.code, "username_taken");
  check("same email, other case", (await reg({ email: `PARTY.${runId}@TEST.LOCAL`, username: `other_${runId}` })).data.code, "email_taken");
  check("nothing half-created after failures", (await call(`/api/username-available?username=other_${runId}`)).data.available, true);
  check("login ignores case and spaces", (await call("/api/login", { method: "POST", body: { email: ` PARTY.${runId}@test.local`, password: "Strong-pass9" } })).status, 200);
  check("venue needs no birth date", (await call("/api/register", { method: "POST", body: { user_type: 2, email: `v.${runId}@test.local`, password: "Strong-pass9", username: `club_${runId}`, title: "Club", accepted_terms: true } })).status, 200);
  check("users and venues share usernames", (await call(`/api/username-available?username=CLUB_${runId}`)).data.available, false);

  // ── Old plain-text passwords are no longer accepted ──
  const legacy = await registerUser("legacy", { complete: false });
  sql(`UPDATE login_data SET password = 'Plain-text-1' WHERE id = ${legacy.userId}`);
  check("plain-text password rejected", (await call("/api/login", { method: "POST", body: { email: legacy.email, password: "Plain-text-1" } })).status, 401);

  // ── Password change ──
  const a = await registerUser("pw", { complete: false });
  const otherDevice = (await call("/api/login", { method: "POST", body: { email: a.email, password: "Strong-pass9" } })).data.token;
  const change = (body, token = a.token) => call(`/api/login/${a.userId}`, { method: "PUT", token, body });
  check("wrong current password", (await change({ password: "New-strong-pass1", current_password: "nope" })).data.code, "wrong_password");
  check("current password required", (await change({ password: "New-strong-pass1" })).status, 403);
  check("new password must be strong", (await change({ password: "short", current_password: "Strong-pass9" })).data.code, "weak_password");
  const changed = await change({ password: "New-strong-pass1", current_password: "Strong-pass9" });
  check("changed, fresh token returned", [changed.status, typeof changed.data.token], [200, "string"]);
  check("old token on this device stops working", (await call("/api/venues", { token: a.token })).status, 401);
  check("other devices are logged out", (await call("/api/venues", { token: otherDevice })).status, 401);
  check("fresh token works", (await call("/api/venues", { token: changed.data.token })).status, 200);
  check("old password no longer works", (await call("/api/login", { method: "POST", body: { email: a.email, password: "Strong-pass9" } })).status, 401);
  check("new password works", (await call("/api/login", { method: "POST", body: { email: a.email, password: "New-strong-pass1" } })).status, 200);

  // ── Deleted accounts ──
  const gone = await registerUser("gone", { complete: false });
  await call(`/api/user/${gone.userId}`, { method: "DELETE", token: gone.token });
  check("token of a deleted account → 401", (await call("/api/venues", { token: gone.token })).status, 401);

  // ── Rate limit: 10 logins a minute per IP ──
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    statuses.push((await call("/api/login", { method: "POST", ip: "10.99.99.99", body: { email: "nobody@test.local", password: "x" } })).status);
  }
  check("11th login a minute → 429", [statuses.slice(0, 10).every((s) => s === 401), statuses[10]], [true, 429]);
  check("other IPs unaffected", (await call("/api/login", { method: "POST", ip: "10.88.88.88", body: { email: "nobody@test.local", password: "x" } })).status, 401);
};
