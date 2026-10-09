-- Each post remembers its photo's shape (width ÷ height, already kept between
-- 0.8 and 1.91). Older posts have NULL and show as 4:5.
ALTER TABLE posts ADD COLUMN photo_ratio REAL;
