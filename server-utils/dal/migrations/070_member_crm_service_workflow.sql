-- 2026-08-10: CRM-only member visibility and service delivery documents.
-- Additive and idempotent. This does not modify users, membership state, C-end resumes, or matching data.

CREATE TABLE IF NOT EXISTS member_crm_exclusions (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  excluded_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_crm_exclusions_time
  ON member_crm_exclusions(excluded_at DESC);

CREATE TABLE IF NOT EXISTS member_crm_service_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_record_id UUID NOT NULL REFERENCES member_crm_service_records(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_content BYTEA NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_crm_service_document_size_check CHECK (file_size > 0 AND file_size <= 10485760),
  CONSTRAINT member_crm_service_document_type_check CHECK (file_type IN ('pdf', 'docx', 'txt'))
);

CREATE INDEX IF NOT EXISTS idx_member_crm_service_documents_record
  ON member_crm_service_documents(service_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_crm_service_documents_user
  ON member_crm_service_documents(user_id, created_at DESC);
