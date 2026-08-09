-- 2026-08-09: Member CRM for Club Starter / Member / Partner operations.
-- Additive and idempotent: no C-end tables or resume behavior are changed.

-- Production users.user_id is VARCHAR. The earlier entitlement migration used UUID
-- references and therefore could stop after creating only the definition table.
-- Recreate the missing ledgers with the real production key type before CRM tables.
CREATE TABLE IF NOT EXISTS user_member_service_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL REFERENCES member_service_entitlement_definitions(entitlement_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'available',
  total_quota INTEGER,
  used_quota INTEGER NOT NULL DEFAULT 0,
  remaining_quota INTEGER,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entitlement_key),
  CONSTRAINT user_member_service_entitlements_status_check CHECK (
    status IN ('available','not_scheduled','scheduled','completed','reviewing','approved','expired',
      'unavailable','unused','used','registered','attended','not_applied','rejected','requested','published')
  ),
  CONSTRAINT user_member_service_entitlements_quota_check CHECK (total_quota IS NULL OR total_quota >= 0),
  CONSTRAINT user_member_service_entitlements_used_check CHECK (used_quota >= 0),
  CONSTRAINT user_member_service_entitlements_remaining_check CHECK (remaining_quota IS NULL OR remaining_quota >= 0)
);

CREATE TABLE IF NOT EXISTS user_member_service_entitlement_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  admin_user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_member_service_entitlements_user
  ON user_member_service_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_member_service_entitlements_status
  ON user_member_service_entitlements(status);

CREATE TABLE IF NOT EXISTS member_crm_profiles (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  background_summary TEXT NOT NULL DEFAULT '',
  detailed_background TEXT NOT NULL DEFAULT '',
  primary_needs TEXT NOT NULL DEFAULT '',
  pain_points TEXT NOT NULL DEFAULT '',
  service_plan TEXT NOT NULL DEFAULT '',
  service_stage TEXT NOT NULL DEFAULT 'not_started',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_profiles_stage_check CHECK (
    service_stage IN ('not_started', 'onboarding', 'in_service', 'follow_up', 'paused', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_member_crm_profiles_follow_up
  ON member_crm_profiles(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_crm_profiles_stage
  ON member_crm_profiles(service_stage);

CREATE TABLE IF NOT EXISTS member_crm_service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entitlement_key TEXT REFERENCES member_service_entitlement_definitions(entitlement_key) ON DELETE SET NULL,
  service_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  details TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_service_status_check CHECK (
    status IN ('planned', 'scheduled', 'in_progress', 'completed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_member_crm_service_user
  ON member_crm_service_records(user_id, created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS member_crm_resume_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_content BYTEA NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  content_text TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_resume_size_check CHECK (file_size > 0 AND file_size <= 10485760),
  CONSTRAINT member_crm_resume_type_check CHECK (file_type IN ('pdf', 'docx', 'txt'))
);

CREATE INDEX IF NOT EXISTS idx_member_crm_resume_user
  ON member_crm_resume_documents(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS member_crm_manual_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  application_channel TEXT NOT NULL DEFAULT 'external',
  applied_at TIMESTAMPTZ,
  current_status TEXT NOT NULL DEFAULT 'pending_apply',
  notes TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_crm_manual_application_user
  ON member_crm_manual_applications(user_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS member_crm_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  site_interaction_id BIGINT,
  manual_application_id UUID REFERENCES member_crm_manual_applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_follow_up_at TIMESTAMPTZ,
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_application_event_target_check CHECK (
    num_nonnulls(site_interaction_id, manual_application_id) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_member_crm_application_event_user
  ON member_crm_application_events(user_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_crm_application_event_site
  ON member_crm_application_events(site_interaction_id, event_at DESC)
  WHERE site_interaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_crm_application_event_manual
  ON member_crm_application_events(manual_application_id, event_at DESC)
  WHERE manual_application_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_crm_audit_log (
  id BIGSERIAL PRIMARY KEY,
  target_user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  admin_user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_crm_audit_user
  ON member_crm_audit_log(target_user_id, created_at DESC);

ALTER TABLE job_bundles
  ADD COLUMN IF NOT EXISTS job_snapshots JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve current job identity before a job is later unpublished or deleted.
UPDATE job_bundles bundle
SET job_snapshots = COALESCE((
  SELECT jsonb_object_agg(
    item.job_id,
    jsonb_build_object(
      'title', COALESCE(job.title, ''),
      'company', COALESCE(job.company, ''),
      'captured_at', NOW()
    )
  )
  FROM jsonb_array_elements_text(COALESCE(bundle.job_ids, '[]'::jsonb)) item(job_id)
  LEFT JOIN jobs job ON job.job_id = item.job_id
), '{}'::jsonb)
WHERE COALESCE(bundle.job_snapshots, '{}'::jsonb) = '{}'::jsonb;

-- Move legacy JSON entitlement values into the normalized entitlement ledger.
DO $$
BEGIN
  IF to_regclass('public.user_member_service_entitlements') IS NOT NULL THEN
    INSERT INTO user_member_service_entitlements (
      user_id, entitlement_key, status, total_quota, used_quota, remaining_quota,
      expires_at, metadata, notes, created_at, updated_at
    )
    SELECT
      users.user_id,
      legacy.key,
      CASE
        WHEN legacy.value->>'status' IN (
          'available','not_scheduled','scheduled','completed','reviewing','approved',
          'expired','unavailable','unused','used','registered','attended','not_applied',
          'rejected','requested','published'
        ) THEN legacy.value->>'status'
        ELSE definitions.default_status
      END,
      definitions.default_total_quota,
      CASE WHEN legacy.value->>'status' IN ('completed','used','attended','published') THEN 1 ELSE 0 END,
      CASE
        WHEN definitions.default_total_quota IS NULL THEN NULL
        WHEN legacy.value->>'status' IN ('completed','used','attended','published') THEN GREATEST(definitions.default_total_quota - 1, 0)
        ELSE definitions.default_total_quota
      END,
      NULLIF(legacy.value->>'expiredAt', '')::timestamptz,
      jsonb_strip_nulls(jsonb_build_object(
        'appointmentAt', NULLIF(legacy.value->>'appointmentAt', ''),
        'completedAt', NULLIF(legacy.value->>'completedAt', ''),
        'legacyUpdatedAt', NULLIF(legacy.value->>'updatedAt', '')
      )),
      COALESCE(legacy.value->>'note', ''),
      NOW(),
      NOW()
    FROM users
    CROSS JOIN LATERAL jsonb_each(COALESCE(users.profile->'memberServiceEntitlements', '{}'::jsonb)) legacy
    JOIN member_service_entitlement_definitions definitions ON definitions.entitlement_key = legacy.key
    ON CONFLICT (user_id, entitlement_key) DO NOTHING;
  END IF;
END $$;
