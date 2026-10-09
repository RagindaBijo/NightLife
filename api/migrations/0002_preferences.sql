-- 0002 – Music and venue preferences (shown on Discover cards)
-- At least 3 of each are part of a complete profile.

CREATE TABLE IF NOT EXISTS user_music (
  user_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  genre   TEXT    NOT NULL,                       -- e.g. 'techno', 'hip_hop'
  PRIMARY KEY (user_id, genre)
);

CREATE TABLE IF NOT EXISTS user_venue_types (
  user_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  type    TEXT    NOT NULL,                       -- e.g. 'rooftop', 'cocktail_bar'
  PRIMARY KEY (user_id, type)
);
