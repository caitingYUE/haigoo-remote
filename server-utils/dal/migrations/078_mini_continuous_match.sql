CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE mini_career_profiles
  ADD COLUMN IF NOT EXISTS structured_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS profile_completeness NUMERIC(5, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_match_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mini_career_profiles_profile_hash
  ON mini_career_profiles(profile_hash);

CREATE TABLE IF NOT EXISTS company_job_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE RESTRICT,
  source_job_id VARCHAR(255),
  source_url_hash VARCHAR(64) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  role_families JSONB NOT NULL DEFAULT '[]'::jsonb,
  normalized_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  industry TEXT NOT NULL DEFAULT '',
  experience_level TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  payload_hash VARCHAR(64) NOT NULL,
  evidence_quality NUMERIC(5, 4) NOT NULL DEFAULT 0.5,
  is_public_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, source_url_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_job_history_source_job
  ON company_job_history(company_id, source_job_id)
  WHERE source_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_job_history_company_recency
  ON company_job_history(company_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_job_history_public
  ON company_job_history(company_id, is_public_opportunity, closed_at);
CREATE INDEX IF NOT EXISTS idx_company_job_history_role_families
  ON company_job_history USING GIN(role_families);

CREATE TABLE IF NOT EXISTS company_hiring_profiles (
  company_id VARCHAR(255) PRIMARY KEY REFERENCES trusted_companies(company_id) ON DELETE RESTRICT,
  profile_version INTEGER NOT NULL DEFAULT 1,
  role_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  skill_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  seniority_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  remote_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  current_opportunity_count INTEGER NOT NULL DEFAULT 0,
  latest_evidence_at TIMESTAMPTZ,
  fingerprint_hash VARCHAR(64) NOT NULL DEFAULT '',
  algorithm_version VARCHAR(64) NOT NULL DEFAULT 'company-match-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_hiring_profiles_updated
  ON company_hiring_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_hiring_profiles_roles
  ON company_hiring_profiles USING GIN(role_distribution);

CREATE TABLE IF NOT EXISTS mini_match_recommendation_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES mini_career_profiles(profile_id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL,
  catalog_version VARCHAR(128) NOT NULL,
  algorithm_version VARCHAR(64) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, profile_version, catalog_version, algorithm_version)
);

CREATE INDEX IF NOT EXISTS idx_mini_match_runs_user_recent
  ON mini_match_recommendation_runs(user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS mini_match_exposures (
  exposure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE RESTRICT,
  show_count INTEGER NOT NULL DEFAULT 0,
  last_shown_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_match_exposures_user
  ON mini_match_exposures(user_id, last_shown_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS mini_company_follows (
  follow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  wechat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  wechat_template_status VARCHAR(24) NOT NULL DEFAULT 'not_requested'
    CHECK (wechat_template_status IN ('not_requested', 'accepted', 'rejected', 'unavailable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_company_follows_company
  ON mini_company_follows(company_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_company_follows_user
  ON mini_company_follows(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mini_company_update_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('job_added', 'job_reopened', 'company_updated')),
  event_hash VARCHAR(64) NOT NULL UNIQUE,
  role_families JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_public_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
  source_job_id VARCHAR(255),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mini_company_update_events_company
  ON mini_company_update_events(company_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS mini_company_update_inbox (
  inbox_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES mini_company_update_events(event_id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  notification_status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'not_requested', 'sent', 'failed')),
  read_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_mini_company_update_inbox_user
  ON mini_company_update_inbox(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS mini_web_session_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id VARCHAR(255) REFERENCES jobs(job_id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mini_web_session_tickets_expiry
  ON mini_web_session_tickets(expires_at)
  WHERE used_at IS NULL;

-- Preserve today's trusted-company jobs as the first evidence snapshot. The
-- JavaScript backfill enriches role families and skills after this migration.
INSERT INTO company_job_history (
  company_id, source_job_id, source_url_hash, title, description, category,
  industry, experience_level, location, timezone, first_seen_at, last_seen_at,
  source_published_at, closed_at, payload_hash, evidence_quality, is_public_opportunity
)
SELECT DISTINCT ON (
         tc.company_id,
         encode(digest(COALESCE(NULLIF(BTRIM(jobs.url), ''), jobs.job_id), 'sha256'), 'hex')
       )
       tc.company_id,
       jobs.job_id,
       encode(digest(COALESCE(NULLIF(BTRIM(jobs.url), ''), jobs.job_id), 'sha256'), 'hex'),
       COALESCE(NULLIF(BTRIM(jobs.title), ''), '未命名岗位'),
       COALESCE(jobs.description, ''),
       COALESCE(jobs.category, ''),
       COALESCE(jobs.industry, tc.industry, ''),
       COALESCE(jobs.experience_level, ''),
       COALESCE(jobs.location, ''),
       COALESCE(jobs.timezone, ''),
       COALESCE(jobs.created_at, jobs.updated_at, NOW()),
       COALESCE(jobs.updated_at, jobs.created_at, NOW()),
       jobs.published_at,
       CASE WHEN jobs.status = 'active' THEN NULL ELSE COALESCE(jobs.updated_at, NOW()) END,
       encode(digest(CONCAT_WS('|', jobs.title, jobs.description, jobs.category, jobs.location, jobs.status, jobs.is_approved), 'sha256'), 'hex'),
       CASE WHEN jobs.description IS NOT NULL AND LENGTH(jobs.description) >= 200 THEN 0.9 ELSE 0.65 END,
       COALESCE(
         jobs.status = 'active'
         AND jobs.is_approved = TRUE
         AND NULLIF(BTRIM(jobs.url), '') IS NOT NULL,
         FALSE
       )
  FROM jobs
 JOIN trusted_companies tc
    ON tc.company_id = jobs.company_id
    OR (jobs.company_id IS NULL AND LOWER(BTRIM(tc.name)) = LOWER(BTRIM(jobs.company)))
 WHERE tc.status = 'active'
 ORDER BY tc.company_id,
          encode(digest(COALESCE(NULLIF(BTRIM(jobs.url), ''), jobs.job_id), 'sha256'), 'hex'),
          COALESCE(jobs.updated_at, jobs.created_at) DESC NULLS LAST,
          jobs.job_id DESC
ON CONFLICT (company_id, source_url_hash) DO UPDATE SET
  source_job_id = EXCLUDED.source_job_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  industry = EXCLUDED.industry,
  experience_level = EXCLUDED.experience_level,
  location = EXCLUDED.location,
  timezone = EXCLUDED.timezone,
  last_seen_at = GREATEST(company_job_history.last_seen_at, EXCLUDED.last_seen_at),
  closed_at = EXCLUDED.closed_at,
  payload_hash = EXCLUDED.payload_hash,
  evidence_quality = EXCLUDED.evidence_quality,
  is_public_opportunity = EXCLUDED.is_public_opportunity,
  updated_at = NOW();
