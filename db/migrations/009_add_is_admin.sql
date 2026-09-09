-- 009_add_is_admin.sql

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
