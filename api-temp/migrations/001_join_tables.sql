-- ════════════════════════════════════════════
-- 001 – Join tables for likes, favorites, interests and follows
--
-- Replaces the comma-separated columns:
--   posts.like_ids              → post_likes
--   user_profile.favorite_ids   → venue_favorites
--   user_profile.interested_ids → event_interests
--   user_profile.follower_ids / following_ids → follows
--
-- The old columns are NOT removed here; that happens in a later migration
-- once the new worker and app are live.
-- Safe to run more than once (IF NOT EXISTS / INSERT OR IGNORE).
-- ════════════════════════════════════════════

-- ── Tables ──────────────────────────────────

CREATE TABLE IF NOT EXISTS post_likes (
  post_id     INTEGER NOT NULL REFERENCES posts(id)      ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

CREATE TABLE IF NOT EXISTS venue_favorites (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_venue_favorites_venue ON venue_favorites(venue_id);

CREATE TABLE IF NOT EXISTS event_interests (
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_interests_event ON event_interests(event_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ── Copy existing data ──────────────────────
-- Each block splits a comma-separated column into rows and keeps only ids
-- that still exist (old lists may point to deleted accounts/posts/events).

-- posts.like_ids → post_likes
WITH RECURSIVE split(owner_id, item, rest) AS (
  SELECT id, '', like_ids || ',' FROM posts
  WHERE like_ids IS NOT NULL AND like_ids <> ''
  UNION ALL
  SELECT owner_id,
         TRIM(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO post_likes (post_id, user_id)
SELECT owner_id, CAST(item AS INTEGER) FROM split
WHERE item <> ''
  AND CAST(item AS INTEGER) IN (SELECT id FROM login_data);

-- user_profile.favorite_ids → venue_favorites
WITH RECURSIVE split(owner_id, item, rest) AS (
  SELECT id, '', favorite_ids || ',' FROM user_profile
  WHERE favorite_ids IS NOT NULL AND favorite_ids <> ''
  UNION ALL
  SELECT owner_id,
         TRIM(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO venue_favorites (user_id, venue_id)
SELECT owner_id, CAST(item AS INTEGER) FROM split
WHERE item <> ''
  AND owner_id IN (SELECT id FROM login_data)
  AND CAST(item AS INTEGER) IN (SELECT id FROM venue_profile);

-- user_profile.interested_ids → event_interests
WITH RECURSIVE split(owner_id, item, rest) AS (
  SELECT id, '', interested_ids || ',' FROM user_profile
  WHERE interested_ids IS NOT NULL AND interested_ids <> ''
  UNION ALL
  SELECT owner_id,
         TRIM(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO event_interests (user_id, event_id)
SELECT owner_id, CAST(item AS INTEGER) FROM split
WHERE item <> ''
  AND owner_id IN (SELECT id FROM login_data)
  AND CAST(item AS INTEGER) IN (SELECT id FROM events);

-- user_profile.following_ids → follows (owner follows item)
WITH RECURSIVE split(owner_id, item, rest) AS (
  SELECT id, '', following_ids || ',' FROM user_profile
  WHERE following_ids IS NOT NULL AND following_ids <> ''
  UNION ALL
  SELECT owner_id,
         TRIM(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO follows (follower_id, following_id)
SELECT owner_id, CAST(item AS INTEGER) FROM split
WHERE item <> ''
  AND owner_id <> CAST(item AS INTEGER)
  AND owner_id IN (SELECT id FROM login_data)
  AND CAST(item AS INTEGER) IN (SELECT id FROM login_data);

-- user_profile.follower_ids → follows (item follows owner)
WITH RECURSIVE split(owner_id, item, rest) AS (
  SELECT id, '', follower_ids || ',' FROM user_profile
  WHERE follower_ids IS NOT NULL AND follower_ids <> ''
  UNION ALL
  SELECT owner_id,
         TRIM(substr(rest, 1, instr(rest, ',') - 1)),
         substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO follows (follower_id, following_id)
SELECT CAST(item AS INTEGER), owner_id FROM split
WHERE item <> ''
  AND owner_id <> CAST(item AS INTEGER)
  AND owner_id IN (SELECT id FROM login_data)
  AND CAST(item AS INTEGER) IN (SELECT id FROM login_data);
