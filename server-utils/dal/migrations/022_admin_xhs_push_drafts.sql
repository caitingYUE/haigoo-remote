CREATE TABLE IF NOT EXISTS admin_xhs_push_drafts (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL UNIQUE,
  template_version VARCHAR(50) NOT NULL DEFAULT 'xhs-v1',
  theme_id VARCHAR(50),
  company_summary_text TEXT,
  job_summary_text TEXT,
  company_summary_source VARCHAR(50) NOT NULL DEFAULT 'local',
  job_summary_source VARCHAR(50) NOT NULL DEFAULT 'local',
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_xhs_push_drafts_updated_at
  ON admin_xhs_push_drafts(updated_at DESC);
