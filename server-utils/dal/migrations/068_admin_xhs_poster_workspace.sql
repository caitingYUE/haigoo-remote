ALTER TABLE admin_xhs_push_drafts
  ADD COLUMN IF NOT EXISTS poster_title_text TEXT;

ALTER TABLE admin_xhs_push_drafts
  ADD COLUMN IF NOT EXISTS poster_title_source VARCHAR(50) NOT NULL DEFAULT 'original';

CREATE TABLE IF NOT EXISTS admin_xhs_company_summaries (
  company_key VARCHAR(255) PRIMARY KEY,
  company_id VARCHAR(255),
  company_name TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  summary_source VARCHAR(50) NOT NULL DEFAULT 'manual',
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_xhs_company_summaries_updated_at
  ON admin_xhs_company_summaries(updated_at DESC);
