-- 0005 – Connections and chat (18+)
-- People can chat only when connected: a Discover match, an accepted chat
-- request, or following each other. Chats end after a set time (24h on Free);
-- then the pair has to connect again.

-- Discover swipes. liked = 1 (right) waits for the other person; liked = 0
-- (left) hides that person for a while. Removed when the pair connects or a
-- chat between them ends, so they can meet again.
CREATE TABLE IF NOT EXISTS swipes (
  swiper_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  target_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  liked       INTEGER NOT NULL,
  create_date TEXT    NOT NULL,
  PRIMARY KEY (swiper_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id, liked);

-- "Request to chat" from a profile: pending → accepted / declined
CREATE TABLE IF NOT EXISTS chat_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id      INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  to_id        INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL DEFAULT 'pending',
  create_date  TEXT    NOT NULL,
  respond_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_requests_to ON chat_requests(to_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_pair ON chat_requests(from_id, to_id);

-- One chat per pair at a time (user_a < user_b). source: match | request | follow
CREATE TABLE IF NOT EXISTS chats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  source     TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_pair ON chats(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_chats_b ON chats(user_b);
CREATE INDEX IF NOT EXISTS idx_chats_expires ON chats(expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  body        TEXT    NOT NULL,
  create_date TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);

-- Last message each person has read (for unread counts)
CREATE TABLE IF NOT EXISTS chat_reads (
  chat_id      INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id)
);

-- Expo push tokens (one person can have several devices)
CREATE TABLE IF NOT EXISTS push_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  platform    TEXT,
  language    TEXT,
  update_date TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
