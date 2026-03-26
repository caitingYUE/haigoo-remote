ALTER TABLE trusted_companies
  ADD COLUMN IF NOT EXISTS member_only BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS member_only BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trusted_companies_member_only
  ON trusted_companies(member_only);

CREATE INDEX IF NOT EXISTS idx_jobs_member_only
  ON jobs(member_only);
