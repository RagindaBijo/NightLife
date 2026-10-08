-- 0003 – Safety: blocking, reporting and token revocation

-- Who blocked whom. Blocking hides both people from each other
-- (feed, search, profiles) and stops follows, requests and matches.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  blocked_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- Reports of users, posts or venues, reviewed by the team.
-- The reported person never sees who reported them.
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES login_data(id) ON DELETE SET NULL,
  target_type TEXT    NOT NULL,            -- 'user' | 'post' | 'venue'
  target_id   INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  details     TEXT,
  status      TEXT    NOT NULL DEFAULT 'open', -- 'open' | 'reviewed' | 'dismissed'
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- One report per person per target (repeat taps don't pile up)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_once ON reports(reporter_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, create_date);

-- Raised on password change: tokens issued before that stop working
ALTER TABLE login_data ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
