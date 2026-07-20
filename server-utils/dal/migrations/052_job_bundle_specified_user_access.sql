-- 2026-07-20: Make "specified user" bundles valid and bind access to registered accounts.

ALTER TABLE job_bundles
  ADD COLUMN IF NOT EXISTS allowed_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- The original constraint predates the specified-user visibility mode.
ALTER TABLE job_bundles
  DROP CONSTRAINT IF EXISTS valid_visibility;

ALTER TABLE job_bundles
  ADD CONSTRAINT valid_visibility
  CHECK (visibility IN ('public', 'member', 'specified', 'admin'));

-- Migrate legacy email-only allow-lists to stable user IDs where possible.
UPDATE job_bundles bundle
SET allowed_user_ids = COALESCE((
  SELECT jsonb_agg(users.user_id ORDER BY users.created_at DESC)
  FROM users
  WHERE LOWER(users.email) IN (
    SELECT LOWER(value)
    FROM jsonb_array_elements_text(COALESCE(bundle.allowed_emails, '[]'::jsonb)) AS email(value)
  )
), '[]'::jsonb)
WHERE jsonb_array_length(COALESCE(bundle.allowed_user_ids, '[]'::jsonb)) = 0
  AND jsonb_array_length(COALESCE(bundle.allowed_emails, '[]'::jsonb)) > 0;

CREATE INDEX IF NOT EXISTS idx_job_bundles_allowed_user_ids_gin
  ON job_bundles USING GIN (allowed_user_ids);

COMMENT ON COLUMN job_bundles.allowed_user_ids
  IS 'Stable registered-user IDs allowed to access a specified-user bundle. Emails are retained only as an admin display/audit snapshot.';
