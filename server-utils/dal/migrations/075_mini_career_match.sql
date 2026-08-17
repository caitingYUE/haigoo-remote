CREATE TABLE IF NOT EXISTS mini_career_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  source_type VARCHAR(24) NOT NULL DEFAULT 'manual',
  career_text TEXT NOT NULL DEFAULT '',
  intake JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy VARCHAR(24) NOT NULL,
  expires_at TIMESTAMPTZ,
  privacy_version VARCHAR(64) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (user_id),
  CONSTRAINT mini_career_profiles_retention_check
    CHECK (retention_policy IN ('session', '30_days', '90_days', 'long_term'))
);

CREATE INDEX IF NOT EXISTS idx_mini_career_profiles_expiry
  ON mini_career_profiles (expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS mini_career_assessment_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES mini_career_profiles(profile_id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  clarification_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarification_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  company_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider VARCHAR(64),
  model VARCHAR(128),
  workflow_version VARCHAR(128),
  prompt_version VARCHAR(128),
  parser_version VARCHAR(128),
  idempotency_key VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mini_career_runs_user_created
  ON mini_career_assessment_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mini_career_entitlements (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  free_assessment_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mini_career_privacy_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(48) NOT NULL,
  retention_policy VARCHAR(24),
  expires_at TIMESTAMPTZ,
  privacy_version VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mini_career_profiles IS
  'Redacted career-only information for the mini program Match flow. Raw resume files are never stored here.';
COMMENT ON TABLE mini_career_privacy_events IS
  'Content-free audit events for retention consent and deletion.';
