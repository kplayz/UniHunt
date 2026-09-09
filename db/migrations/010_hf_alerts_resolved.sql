-- 010_hf_alerts_resolved.sql

ALTER TABLE IF EXISTS hf_alerts
  ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_hf_alerts_resolved ON hf_alerts(resolved);
