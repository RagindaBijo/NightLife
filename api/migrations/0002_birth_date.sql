-- 0002 – Date of birth ("YYYY-MM-DD") for personal accounts.
-- Kept in login_data (private, never returned by public profile routes).
-- Needed for 18+ features (Discover and chat); the rest of the app is 13+.

ALTER TABLE login_data ADD COLUMN birth_date TEXT;
