-- ════════════════════════════════════════════
-- 003 – Venue types and venue ratings
--
--   venue_types   – the styles a venue picks (several per venue)
--   venue_ratings – one 1–5 star rating per user per venue
--
-- Safe to run more than once (IF NOT EXISTS).
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS venue_types (
  venue_id INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  type     TEXT    NOT NULL,
  PRIMARY KEY (venue_id, type)
);
CREATE INDEX IF NOT EXISTS idx_venue_types_type ON venue_types(type);

CREATE TABLE IF NOT EXISTS venue_ratings (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_venue_ratings_venue ON venue_ratings(venue_id);
