-- ════════════════════════════════════════════
-- 002 – Drop columns replaced by join tables / other tables
--
--   posts.like_ids              → post_likes
--   user_profile.favorite_ids   → venue_favorites
--   user_profile.interested_ids → event_interests
--   user_profile.follower_ids   → follows
--   user_profile.following_ids  → follows
--   user_profile.post_ids       → posts.user_id
--   venue_profile.event_ids     → events.venue_id
--   user_profile.photo_ids      → unused
--
-- Run only after the new worker + app are live and migration 001 has been
-- re-run. NOT safe to run twice: DROP COLUMN fails once a column is gone.
-- ════════════════════════════════════════════

-- Triggers that maintain the comma-separated lists must go first
-- (SQLite refuses to drop a column a trigger still uses)
DROP TRIGGER IF EXISTS after_post_insert;
DROP TRIGGER IF EXISTS before_post_delete;
DROP TRIGGER IF EXISTS add_event_to_venue;

ALTER TABLE posts DROP COLUMN like_ids;

ALTER TABLE user_profile DROP COLUMN favorite_ids;
ALTER TABLE user_profile DROP COLUMN interested_ids;
ALTER TABLE user_profile DROP COLUMN follower_ids;
ALTER TABLE user_profile DROP COLUMN following_ids;
ALTER TABLE user_profile DROP COLUMN post_ids;
ALTER TABLE user_profile DROP COLUMN photo_ids;

ALTER TABLE venue_profile DROP COLUMN event_ids;
