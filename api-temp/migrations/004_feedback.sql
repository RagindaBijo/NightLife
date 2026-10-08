-- ════════════════════════════════════════════
-- 004 – Feedback sent from the app's Settings → Send feedback
--
-- Read submissions with e.g.:
--   SELECT * FROM feedback ORDER BY create_date DESC;
--
-- Safe to run more than once (IF NOT EXISTS).
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Kept when the account is deleted, just without the link to it
  user_id     INTEGER REFERENCES login_data(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(create_date);
