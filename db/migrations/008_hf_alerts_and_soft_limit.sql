-- 008_hf_alerts_and_soft_limit.sql

-- Add soft limit column to profiles
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS hf_soft_limit integer;

-- Table to record HF alert emails / notifications
CREATE TABLE IF NOT EXISTS hf_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  message text,
  email_to text,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hf_alerts_user ON hf_alerts(user_id);
