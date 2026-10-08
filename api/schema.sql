PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE login_data (     id INTEGER PRIMARY KEY AUTOINCREMENT,     email TEXT NOT NULL UNIQUE,     password TEXT NOT NULL,     user_type INTEGER NOT NULL,     last_active DATETIME,     create_date DATETIME DEFAULT CURRENT_TIMESTAMP,     update_date DATETIME );
CREATE TABLE user_profile (     id INTEGER PRIMARY KEY,     username TEXT,     user_type INTEGER NOT NULL,     first_name TEXT,     last_name TEXT,     profile_photo TEXT,     ticket_ids TEXT,     create_date DATETIME DEFAULT CURRENT_TIMESTAMP,     update_date DATETIME, bio_text TEXT,     FOREIGN KEY (id) REFERENCES login_data(id) );
CREATE TABLE venue_profile (     id INTEGER PRIMARY KEY,     username TEXT,     user_type INTEGER NOT NULL,     title TEXT,     address TEXT,     about TEXT,     status TEXT,     photo_ids TEXT,     create_date DATETIME DEFAULT CURRENT_TIMESTAMP,     update_date DATETIME, public_status INTEGER DEFAULT 0, open_hours TEXT DEFAULT 'Mon-Sun: 10AM-10PM', lat_long TEXT,     FOREIGN KEY (id) REFERENCES login_data(id) );
CREATE TABLE events (     id INTEGER PRIMARY KEY AUTOINCREMENT,     venue_id INTEGER NOT NULL,     title TEXT,     time DATETIME,     about TEXT,     create_date DATETIME DEFAULT CURRENT_TIMESTAMP,     update_date DATETIME, photo_id TEXT,     FOREIGN KEY (venue_id) REFERENCES venue_profile(id) );
CREATE TABLE posts (     id INTEGER PRIMARY KEY AUTOINCREMENT,     user_id INTEGER NOT NULL,     post_text TEXT NOT NULL,     photo_id TEXT,     create_date DATETIME DEFAULT CURRENT_TIMESTAMP,     update_date DATETIME DEFAULT CURRENT_TIMESTAMP , location_tag VARCHAR(255));
CREATE TABLE post_likes (
  post_id     INTEGER NOT NULL REFERENCES posts(id)      ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE venue_favorites (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
CREATE TABLE event_interests (
  user_id     INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id)
);
CREATE TABLE follows (
  follower_id  INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES login_data(id) ON DELETE CASCADE,
  create_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE TABLE feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Kept when the account is deleted, just without the link to it
  user_id     INTEGER REFERENCES login_data(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE venue_types (
  venue_id INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  type     TEXT    NOT NULL,
  PRIMARY KEY (venue_id, type)
);
CREATE TABLE venue_ratings (
  user_id     INTEGER NOT NULL REFERENCES login_data(id)    ON DELETE CASCADE,
  venue_id    INTEGER NOT NULL REFERENCES venue_profile(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id)
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_post_likes_user ON post_likes(user_id);
CREATE INDEX idx_venue_favorites_venue ON venue_favorites(venue_id);
CREATE INDEX idx_event_interests_event ON event_interests(event_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_feedback_date ON feedback(create_date);
CREATE INDEX idx_venue_types_type ON venue_types(type);
CREATE INDEX idx_venue_ratings_venue ON venue_ratings(venue_id);
CREATE TRIGGER delete_user_profile AFTER DELETE ON login_data WHEN OLD.user_type = 1 BEGIN     DELETE FROM user_profile WHERE id = OLD.id; END;
CREATE TRIGGER delete_venue_profile AFTER DELETE ON login_data WHEN OLD.user_type = 2 BEGIN     DELETE FROM venue_profile WHERE id = OLD.id; END;
CREATE TRIGGER after_post_update AFTER UPDATE ON posts FOR EACH ROW WHEN NEW.update_date = OLD.update_date BEGIN     UPDATE posts SET update_date = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER insert_user_profile AFTER INSERT ON login_data WHEN NEW.user_type = 1 BEGIN INSERT INTO user_profile (id, username, user_type, create_date)       VALUES (NEW.id, NULL, NEW.user_type, NEW.create_date); END;
CREATE TRIGGER insert_venue_profile AFTER INSERT ON login_data WHEN NEW.user_type = 2 BEGIN INSERT INTO venue_profile (id, username, user_type, create_date)       VALUES (NEW.id, NULL, NEW.user_type, NEW.create_date); END;
