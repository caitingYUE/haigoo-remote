ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS assistant_payload JSONB,
  ADD COLUMN IF NOT EXISTS assistant_version VARCHAR(64),
  ADD COLUMN IF NOT EXISTS assistant_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_resumes_assistant_updated_at
  ON resumes (assistant_updated_at DESC);
