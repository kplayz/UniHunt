-- 007_hf_usage.sql

CREATE TABLE IF NOT EXISTS hf_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  calls integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_hf_usage_date ON hf_usage(usage_date);
