-- 2026-01-05 Job Approval Workflow Migration

-- 1. Add is_approved column to jobs table (default false for safety)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- 2. Backfill existing ACTIVE jobs as approved (to prevent them from disappearing)
--    We assume currently active jobs are already vetted or at least acceptable.
--    Inactive jobs remain unapproved until they are reactivated and checked.
UPDATE jobs SET is_approved = true WHERE status = 'active';

-- 3. (Optional) If you want to verify the update
-- SELECT status, is_approved, COUNT(*) FROM jobs GROUP BY status, is_approved;
