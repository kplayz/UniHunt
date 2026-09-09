-- 011_hf_alerts_notify.sql

ALTER TABLE IF EXISTS hf_alerts
  ADD COLUMN IF NOT EXISTS notify boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_hf_alerts_notify ON hf_alerts(notify);
