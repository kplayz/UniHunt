-- 006_profile_settings.sql

-- Add per-user settings to profiles table
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS semantic_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hf_daily_limit integer DEFAULT 50;

-- Index for hf_daily_limit if needed later
CREATE INDEX IF NOT EXISTS idx_profiles_hf_limit ON profiles(hf_daily_limit);
