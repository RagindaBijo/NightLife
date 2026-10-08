-- 0001 – Sign-up rules
--   • when the user accepted the Terms of Use (required to register)
--   • usernames unique, ignoring letter case (users and venues are also
--     checked against each other in the worker)

ALTER TABLE login_data ADD COLUMN terms_accepted_at DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_username
  ON user_profile (username COLLATE NOCASE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_profile_username
  ON venue_profile (username COLLATE NOCASE);
