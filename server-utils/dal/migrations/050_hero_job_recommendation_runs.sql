CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hero_job_recommendation_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  context_key TEXT NOT NULL,
  recommendation_date DATE NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hero_job_recommendation_runs_user_context_date_key
    UNIQUE (user_id, context_key, recommendation_date)
);

CREATE INDEX IF NOT EXISTS idx_hero_job_recommendation_runs_user_generated
  ON hero_job_recommendation_runs (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hero_job_recommendation_runs_user_date
  ON hero_job_recommendation_runs (user_id, recommendation_date DESC);

COMMENT ON TABLE hero_job_recommendation_runs IS
  'Stable daily hero job recommendation snapshots used for once-per-day refresh and recent-run deduplication.';

COMMENT ON COLUMN hero_job_recommendation_runs.context_key IS
  'Normalized career direction, position type, and resume context for one recommendation stream.';
