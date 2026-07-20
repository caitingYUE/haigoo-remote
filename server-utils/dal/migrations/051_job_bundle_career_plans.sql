-- 2026-07-19: Support member-specific job bundles with curated career-learning plans.

ALTER TABLE job_bundles
  ADD COLUMN IF NOT EXISTS career_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_emails JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS job_bundle_user_progress (
  bundle_id INTEGER NOT NULL REFERENCES job_bundles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  completed_video_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  growth_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bundle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_bundle_user_progress_user
  ON job_bundle_user_progress (user_id, updated_at DESC);

COMMENT ON COLUMN job_bundles.career_items
  IS 'Ordered array of curated career-learning videos: [{ video_id, guidance }].';

COMMENT ON COLUMN job_bundles.allowed_emails
  IS 'Lowercase registered emails that can view a specified-person bundle.';
