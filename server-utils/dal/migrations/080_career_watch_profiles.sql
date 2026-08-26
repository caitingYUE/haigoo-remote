CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS career_watch_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  source_mode VARCHAR(16) NOT NULL DEFAULT 'manual'
    CHECK (source_mode IN ('resume', 'manual', 'mixed')),
  role_families JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_role_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_preference_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  tolerance_mode VARCHAR(16) NOT NULL DEFAULT 'balanced'
    CHECK (tolerance_mode IN ('balanced', 'strict')),
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  resume_id TEXT,
  career_profile_id UUID REFERENCES mini_career_profiles(profile_id) ON DELETE SET NULL,
  source_platform VARCHAR(24) NOT NULL DEFAULT 'web',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id),
  CONSTRAINT career_watch_role_families_array CHECK (jsonb_typeof(role_families) = 'array'),
  CONSTRAINT career_watch_active_preferences_array CHECK (jsonb_typeof(active_preference_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_career_watch_profiles_status_updated
  ON career_watch_profiles(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS career_watch_feed_snapshots (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  followed_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  empty_reason VARCHAR(32),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE career_watch_profiles IS
  'Shared mini-program and website career watch configuration. Contains structured preferences only, never raw resume content.';
