
-- 2025-12-17: Add is_manually_edited to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT false;

-- 2025-12-17: Add system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exist
INSERT INTO system_settings (key, value, description)
VALUES 
  ('ai_translation_enabled', 'false'::jsonb, 'Whether to enable paid AI translation services (DeepSeek/Bailian)'),
  ('ai_token_usage', '{"input": 0, "output": 0, "total": 0}'::jsonb, 'Token usage statistics for AI services')
ON CONFLICT (key) DO NOTHING;
