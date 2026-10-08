-- 0004 – Real event start time
--   starts_at: ISO 8601 in UTC, e.g. "2026-03-05T16:00:00.000Z" (= 20:00 in Tbilisi).
--   Sortable as text, so lists can show upcoming events soonest first and hide
--   past ones. The old free-text `time` column is kept (filled with the same
--   value) so older app versions keep working.

ALTER TABLE events ADD COLUMN starts_at TEXT;
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
