-- 2026-02-14: Fix Missing Columns for Production Stability
-- Description: Add missing columns identified in error logs (is_approved, timezone)

-- 1. Add is_approved column to jobs table (default true for existing active jobs to avoid data loss)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;

-- 2. Add timezone column to jobs table (for better remote job filtering)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

-- 3. Add is_featured column if missing (used in featured_home query)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 4. Add indexes for performance on these new columns
CREATE INDEX IF NOT EXISTS idx_jobs_is_approved ON jobs(is_approved);
CREATE INDEX IF NOT EXISTS idx_jobs_timezone ON jobs(timezone);

-- 5. Ensure user_job_matches table exists and has match_score (for personalization)
CREATE TABLE IF NOT EXISTS user_job_matches (
    user_id VARCHAR(255) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    match_score INTEGER,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id)
);

-- 6. Add index for match_score sorting
CREATE INDEX IF NOT EXISTS idx_user_job_matches_score ON user_job_matches(match_score DESC);
