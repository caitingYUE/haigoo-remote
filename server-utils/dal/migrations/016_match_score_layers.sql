-- 2026-03-20: Add true/display match score layers for recommendation calibration
-- Description: Separate internal ranking score from product display score and persist calibration metadata

ALTER TABLE user_job_matches
ADD COLUMN IF NOT EXISTS true_match_score INTEGER,
ADD COLUMN IF NOT EXISTS display_match_score INTEGER,
ADD COLUMN IF NOT EXISTS display_band VARCHAR(16),
ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
ADD COLUMN IF NOT EXISTS constraint_flags JSONB,
ADD COLUMN IF NOT EXISTS algorithm_version VARCHAR(64),
ADD COLUMN IF NOT EXISTS calibration_version VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_user_job_matches_true_score
ON user_job_matches(user_id, true_match_score DESC);

CREATE INDEX IF NOT EXISTS idx_user_job_matches_display_band
ON user_job_matches(display_band);
