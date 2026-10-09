-- Following a personal account is a request until that person accepts it.
-- `follows` keeps holding only accepted follows, so counts, lists and the
-- mutual-follow chat rule are unchanged.
CREATE TABLE IF NOT EXISTS follow_requests (
  requester_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  target_id    INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requester_id, target_id),
  CHECK (requester_id <> target_id)
);
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests(target_id);

-- 1 when the follow started as a request that was accepted ("X accepted your request")
ALTER TABLE follows ADD COLUMN via_request INTEGER NOT NULL DEFAULT 0;

-- Notifications newer than this are unread (same format as CURRENT_TIMESTAMP)
ALTER TABLE login_data ADD COLUMN notifications_seen_at TEXT;
