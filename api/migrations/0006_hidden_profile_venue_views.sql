-- 0006 – Hidden profiles and venue view totals

-- 1 = keep me out of Discover and people search (followers and chats are unaffected)
ALTER TABLE user_profile ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;

-- Who opened a venue's page, at most once per person per day (UTC), so
-- refreshing doesn't inflate the count. Totals = number of rows.
CREATE TABLE IF NOT EXISTS venue_views (
  venue_id  INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  day       TEXT    NOT NULL, -- "YYYY-MM-DD"
  PRIMARY KEY (venue_id, viewer_id, day)
);
CREATE INDEX IF NOT EXISTS idx_venue_views_venue_day ON venue_views(venue_id, day);
