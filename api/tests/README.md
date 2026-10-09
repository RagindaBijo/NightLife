# API tests

Automated checks for the worker. They run against a **local** copy of the worker
with a **fresh, empty test database** for every suite — live data is never touched.

```
cd api
npm test              # all suites
npm test -- social    # only suites whose file name contains "social"
```

| Suite | Covers |
|---|---|
| `auth.test.cjs` | Sign-up rules, login, password change, token revocation, rate limits |
| `profiles.test.cjs` | Complete-profile rule, hidden profiles, people search, posts, follower lists |
| `safety.test.cjs` | 403 vs 401, length limits, reports, blocking |
| `social.test.cjs` | 18+ gate, Discover, matches, chat requests, chats, live messages, expiry, unread badge |
| `events.test.cjs` | Event start times, upcoming lists, going counts, venue totals |

How it works: `run.cjs` rebuilds the test database from the migrations in
`migrations/` (0001 creates every table), starts `wrangler dev` on it, runs the suite, and stops
the server. Helpers for calling the API, uploading images and creating test
accounts are in `helpers.cjs`.

When you change the database, add a migration (`npx wrangler d1 migrations create
night_life_app <name>`) — the tests pick it up automatically.
