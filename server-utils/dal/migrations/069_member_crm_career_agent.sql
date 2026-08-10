-- 2026-08-10: consultant-only career Skill + Agent workspace for Member CRM.
-- Additive and idempotent. Generated artifacts remain internal to CRM.

CREATE TABLE IF NOT EXISTS member_crm_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  workflow_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  source_resume_kind TEXT NOT NULL,
  source_resume_id TEXT NOT NULL,
  source_resume_name TEXT NOT NULL DEFAULT '',
  source_resume_hash TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  input_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  skill_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT NOT NULL DEFAULT 'alibaba_bailian_cn',
  model TEXT NOT NULL DEFAULT '',
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_agent_run_workflow_check CHECK (
    workflow_key IN ('resume_diagnosis')
  ),
  CONSTRAINT member_crm_agent_run_status_check CHECK (
    status IN ('running', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT member_crm_agent_run_source_check CHECK (
    source_resume_kind IN ('crm', 'user')
  )
);

ALTER TABLE member_crm_agent_runs
  ADD COLUMN IF NOT EXISTS input_options JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_member_crm_agent_runs_user
  ON member_crm_agent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_crm_agent_runs_fingerprint
  ON member_crm_agent_runs(user_id, input_fingerprint, created_at DESC)
  WHERE status = 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_crm_agent_runs_one_running
  ON member_crm_agent_runs(user_id, input_fingerprint)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS member_crm_agent_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES member_crm_agent_runs(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  consultant_notes TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  approved_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_agent_artifact_type_check CHECK (
    artifact_type IN ('resume_diagnosis')
  ),
  CONSTRAINT member_crm_agent_artifact_status_check CHECK (
    status IN ('draft', 'approved', 'archived')
  ),
  CONSTRAINT member_crm_agent_artifact_version_check CHECK (version > 0),
  UNIQUE(run_id, artifact_type)
);

CREATE INDEX IF NOT EXISTS idx_member_crm_agent_artifacts_user
  ON member_crm_agent_artifacts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_crm_agent_artifacts_status
  ON member_crm_agent_artifacts(user_id, status, created_at DESC);
