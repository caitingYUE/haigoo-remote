-- 2026-05-03: Manual editorial reason for featured jobs.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS featured_reason TEXT;

COMMENT ON COLUMN jobs.featured_reason IS 'Optional admin-written recommendation reason for featured job cards.';
