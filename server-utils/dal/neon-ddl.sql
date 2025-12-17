
-- 2025-12-17: Add is_manually_edited to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT false;
