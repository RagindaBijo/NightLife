-- ════════════════════════════════════════════════════════════════
-- 0001 – Night-Life database, complete schema
--
-- Creates every table from scratch. To set up an empty database:
--   npx wrangler d1 migrations apply night_life_app --remote
-- Future changes go in new numbered files (0002_…, 0003_…), created with:
--   npx wrangler d1 migrations create night_life_app <short_name>
-- ════════════════════════════════════════════════════════════════


-- ── Accounts ─────────────────────────────────────────────────────

-- One row per account (person or venue). Private: never returned to others.
CREATE TABLE login_data (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE,      -- stored lower-case
  password          TEXT    NOT NULL,             -- PBKDF2 hash ("pbkdf2$…")
  user_type         INTEGER NOT NULL,             -- 1 = person, 2 = venue
  last_active       DATETIME,
  create_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date       DATETIME,
  terms_accepted_at DATETIME,                     -- when the Terms were accepted at sign-up
  birth_date        TEXT,                         -- "YYYY-MM-DD", people only (18+ for Discover/chat)
  token_version     INTEGER NOT NULL DEFAULT 0    -- raised on password change → older logins stop working
);

-- Public profile of a person (created automatically by a trigger below)
CREATE TABLE user_profile (
  id            INTEGER PRIMARY KEY REFERENCES login_data(id),
  username      TEXT,
  user_type     INTEGER NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  profile_photo TEXT,                             -- R2 key
  ticket_ids    TEXT,                             -- reserved for tickets
  bio_text      TEXT,
  is_hidden     INTEGER NOT NULL DEFAULT 0,       -- 1 = not shown in Discover or people search
  create_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date   DATETIME
);

-- Public profile of a venue (created automatically by a trigger below)
CREATE TABLE venue_profile (
  id            INTEGER PRIMARY KEY REFERENCES login_data(id),
  username      TEXT,
  user_type     INTEGER NOT NULL,
  title         TEXT,
  address       TEXT,
  about         TEXT,
  status        TEXT,                             -- "Tonight" text
  photo_ids     TEXT,                             -- comma-separated R2 keys, first = cover
  public_status INTEGER DEFAULT 0,                -- 1 = visible to guests
  open_hours    TEXT DEFAULT 'Mon-Sun: 10AM-10PM',
  lat_long      TEXT,                             -- "lat,long"
  create_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date   DATETIME
);

-- Usernames are unique across letter case (users and venues are also checked against each other in the worker)
CREATE UNIQUE INDEX idx_user_profile_username ON user_profile (username COLLATE NOCASE);
CREATE UNIQUE INDEX idx_venue_profile_username ON venue_profile (username COLLATE NOCASE);

-- Every new account gets its profile row; deleting the account removes it
CREATE TRIGGER insert_user_profile AFTER INSERT ON login_data WHEN NEW.user_type = 1 BEGIN
  INSERT INTO user_profile (id, username, user_type, create_date) VALUES (NEW.id, NULL, NEW.user_type, NEW.create_date);
END;
CREATE TRIGGER insert_venue_profile AFTER INSERT ON login_data WHEN NEW.user_type = 2 BEGIN
  INSERT INTO venue_profile (id, username, user_type, create_date) VALUES (NEW.id, NULL, NEW.user_type, NEW.create_date);
END;
CREATE TRIGGER delete_user_profile AFTER DELETE ON login_data WHEN OLD.user_type = 1 BEGIN
  DELETE FROM user_profile WHERE id = OLD.id;
END;
CREATE TRIGGER delete_venue_profile AFTER DELETE ON login_data WHEN OLD.user_type = 2 BEGIN
  DELETE FROM venue_profile WHERE id = OLD.id;
END;


-- ── Venues ───────────────────────────────────────────────────────

-- Styles a venue picked (several per venue), e.g. "nightclub", "rooftop"
CREATE TABLE venue_types (
  venue_id INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  type     TEXT    NOT NULL,
  PRIMARY KEY (venue_id, type)
);
CREATE INDEX idx_venue_types_type ON venue_types(type);

-- One 1–5 star rating per person per venue
CREATE TABLE venue_ratings (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
CREATE INDEX idx_venue_ratings_venue ON venue_ratings(venue_id);

CREATE TABLE venue_favorites (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
CREATE INDEX idx_venue_favorites_venue ON venue_favorites(venue_id);

-- Who opened a venue's page, at most once per person per day (venue totals)
CREATE TABLE venue_views (
  venue_id  INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  day       TEXT    NOT NULL,                     -- "YYYY-MM-DD" (UTC)
  PRIMARY KEY (venue_id, viewer_id, day)
);
CREATE INDEX idx_venue_views_venue_day ON venue_views(venue_id, day);


-- ── Events ───────────────────────────────────────────────────────

CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id),
  title       TEXT,
  time        DATETIME,                           -- old text field, kept equal to starts_at for older app versions
  starts_at   TEXT,                               -- ISO 8601 UTC, e.g. "2026-03-05T16:00:00.000Z"
  about       TEXT,
  photo_id    TEXT,                               -- R2 key
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME
);
CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_venue ON events(venue_id);

-- "Interested / going" marks
CREATE TABLE event_interests (
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX idx_event_interests_event ON event_interests(event_id);


-- ── Social: posts, likes, follows ────────────────────────────────

CREATE TABLE posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  post_text    TEXT    NOT NULL,
  photo_id     TEXT,                              -- R2 key
  location_tag VARCHAR(255),
  create_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date  DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Keeps update_date current when a post changes
CREATE TRIGGER after_post_update AFTER UPDATE ON posts FOR EACH ROW WHEN NEW.update_date = OLD.update_date BEGIN
  UPDATE posts SET update_date = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE post_likes (
  post_id     INTEGER NOT NULL REFERENCES posts(id)      ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);

CREATE TABLE follows (
  follower_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);


-- ── Safety ───────────────────────────────────────────────────────

-- Blocking hides two people from each other and ends everything between them
CREATE TABLE blocks (
  blocker_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  blocked_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Reports for the team to review (the reported person never sees who reported)
CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES login_data(id) ON DELETE SET NULL,
  target_type TEXT    NOT NULL,                   -- 'user' | 'post' | 'venue'
  target_id   INTEGER NOT NULL,
  reason      TEXT    NOT NULL,                   -- 'fake_account' | 'sexual_content' | 'other'
  details     TEXT,
  status      TEXT    NOT NULL DEFAULT 'open',    -- 'open' | 'reviewed' | 'dismissed'
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_reports_once ON reports(reporter_id, target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status, create_date);

-- Feedback sent from Settings (kept when the account is deleted, without the link to it)
CREATE TABLE feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES login_data(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,                      -- 'bug' | 'idea' | 'venue' | 'other'
  message     TEXT NOT NULL,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_feedback_date ON feedback(create_date);


-- ── Connections and chat (18+) ───────────────────────────────────

-- Discover swipes: liked = 1 waits for the other person, 0 hides them for a week
CREATE TABLE swipes (
  swiper_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  target_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  liked       INTEGER NOT NULL,
  create_date TEXT    NOT NULL,
  PRIMARY KEY (swiper_id, target_id)
);
CREATE INDEX idx_swipes_target ON swipes(target_id, liked);

-- "Request to chat" from a profile: pending → accepted / declined
CREATE TABLE chat_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id      INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  to_id        INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL DEFAULT 'pending',
  create_date  TEXT    NOT NULL,
  respond_date TEXT
);
CREATE INDEX idx_chat_requests_to ON chat_requests(to_id, status);
CREATE INDEX idx_chat_requests_pair ON chat_requests(from_id, to_id);

-- One chat per pair at a time (user_a < user_b); deleted when it expires
CREATE TABLE chats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  source     TEXT    NOT NULL,                    -- 'match' | 'request' | 'follow'
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX idx_chats_pair ON chats(user_a, user_b);
CREATE INDEX idx_chats_b ON chats(user_b);
CREATE INDEX idx_chats_expires ON chats(expires_at);

CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL REFERENCES chats(id)      ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  body        TEXT    NOT NULL,
  create_date TEXT    NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(chat_id, id);

-- Last message each person has read (unread counts)
CREATE TABLE chat_reads (
  chat_id      INTEGER NOT NULL REFERENCES chats(id)      ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id)
);

-- Expo push tokens (several devices per person), with the app language for the texts
CREATE TABLE push_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  platform    TEXT,
  language    TEXT,
  update_date TEXT    NOT NULL
);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
