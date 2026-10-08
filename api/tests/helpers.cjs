// Test helpers: a fresh local database, the worker running locally, and small
// tools for calling the API and checking results.
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..");
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
// Separate from the normal `wrangler dev` data, wiped before every suite
const STATE_DIR = path.join(API_DIR, ".wrangler", "test-state");
// 1×1 PNG used for uploads
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wrangler(args) {
  return execSync(`npx wrangler ${args}`, {
    cwd: API_DIR,
    stdio: "pipe",
    env: { ...process.env, CI: "true" }, // answers wrangler's yes/no prompts
  }).toString();
}

/** Empty database with the current schema and every migration applied. */
function resetDatabase() {
  // Windows can hold the database file for a moment after the server stops
  fs.rmSync(STATE_DIR, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
  wrangler(`d1 execute night_life_app --local --persist-to "${STATE_DIR}" --file=schema.sql`);
  wrangler(`d1 migrations apply night_life_app --local --persist-to "${STATE_DIR}"`);
}

/** Starts `wrangler dev` on the test database and waits until it answers. */
async function startServer() {
  const isWindows = process.platform === "win32";
  const dev = spawn(
    `npx wrangler dev --port ${PORT} --ip 127.0.0.1 --test-scheduled --persist-to "${STATE_DIR}"`,
    { cwd: API_DIR, shell: true, detached: !isWindows },
  );
  let log = "";
  dev.stdout.on("data", (d) => (log += d));
  dev.stderr.on("data", (d) => (log += d));

  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/venues`);
      break;
    } catch {
      if (i > 90) throw new Error(`wrangler dev did not start:\n${log.slice(-2000)}`);
      await sleep(1000);
    }
  }

  return {
    log: () => log,
    stop: () =>
      new Promise((resolve) => {
        if (isWindows) {
          spawn(`taskkill /pid ${dev.pid} /T /F`, { shell: true }).on("exit", () => setTimeout(resolve, 1500));
        } else {
          try {
            process.kill(-dev.pid, "SIGTERM");
          } catch {
            // already stopped
          }
          setTimeout(resolve, 500);
        }
      }),
  };
}

/** Tools passed to every test suite. */
function createContext() {
  let ipCounter = 0;
  const results = { passed: 0, failed: 0 };
  // Unique per run, so names and emails never clash
  const runId = Date.now().toString(36);

  /** Calls the API. Every request gets its own IP, so rate limits don't interfere. */
  const call = async (urlPath, { method = "GET", body, token, ip } = {}) => {
    ipCounter += 1;
    const res = await fetch(BASE + urlPath, {
      method,
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip ?? `10.${Math.floor(ipCounter / 65000) % 250}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };

  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    results[ok ? "passed" : "failed"] += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : `  (expected ${JSON.stringify(expected)})`}`,
    );
  };

  /** Runs SQL on the test database (e.g. to fake an expired chat). */
  const sql = (command) => wrangler(`d1 execute night_life_app --local --persist-to "${STATE_DIR}" --command "${command}"`);

  /** SQL that returns rows → array of objects. */
  const query = (command) => {
    const out = wrangler(
      `d1 execute night_life_app --local --persist-to "${STATE_DIR}" --json --command "${command}"`,
    );
    return JSON.parse(out.slice(out.indexOf("[")))[0].results;
  };

  /** Uploads the test image; returns its stored key. */
  const uploadImage = async (token, type = "user") => {
    const form = new FormData();
    form.append("file", new Blob([PNG], { type: "image/png" }), "x.png");
    const res = await fetch(`${BASE}/api/upload-image?type=${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "CF-Connecting-IP": `10.250.0.${++ipCounter % 250}` },
      body: form,
    });
    return (await res.json()).key;
  };

  /**
   * Registers a personal account. By default it gets a profile photo too, so the
   * profile is complete (visible, can post and chat). Returns { token, userId, username, email }.
   */
  const registerUser = async (name, { birth_date = "1995-01-01", complete = true, ...extra } = {}) => {
    const username = `${name}_${runId}`;
    const email = `${name}.${runId}@test.local`;
    const res = await call("/api/register", {
      method: "POST",
      body: {
        user_type: 1,
        email,
        password: "Strong-pass9",
        username,
        first_name: name.toUpperCase(),
        last_name: "Test",
        birth_date,
        accepted_terms: true,
        ...extra,
      },
    });
    if (res.status !== 200) throw new Error(`register ${name} failed: ${JSON.stringify(res.data)}`);
    const account = { ...res.data, username, email };
    if (complete) {
      const key = await uploadImage(account.token, "user");
      await call(`/api/user/${account.userId}`, { method: "PUT", token: account.token, body: { profile_photo: key } });
    }
    return account;
  };

  /** Registers a venue account (optionally public). */
  const registerVenue = async (name, { publicVenue = true } = {}) => {
    const res = await call("/api/register", {
      method: "POST",
      body: {
        user_type: 2,
        email: `${name}.${runId}@test.local`,
        password: "Strong-pass9",
        username: `${name}_${runId}`,
        title: `Club ${name.toUpperCase()}`,
        accepted_terms: true,
      },
    });
    if (res.status !== 200) throw new Error(`register venue ${name} failed: ${JSON.stringify(res.data)}`);
    if (publicVenue) {
      await call(`/api/venue/${res.data.userId}`, { method: "PUT", token: res.data.token, body: { public_status: 1 } });
    }
    return { ...res.data, username: `${name}_${runId}` };
  };

  return { BASE, runId, call, check, sql, query, sleep, uploadImage, registerUser, registerVenue, results };
}

module.exports = { resetDatabase, startServer, createContext };
