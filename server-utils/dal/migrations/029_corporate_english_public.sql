CREATE TABLE IF NOT EXISTS corporate_english_company_profiles (
  company_id VARCHAR(255) PRIMARY KEY REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
  culture_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  ceo_thinking_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_tier VARCHAR(24) NOT NULL DEFAULT 'vip',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_english_company_profiles_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT corporate_english_company_profiles_access_tier_check
    CHECK (access_tier IN ('free', 'vip'))
);

ALTER TABLE corporate_english_company_profiles
  ADD COLUMN IF NOT EXISTS other_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_tier VARCHAR(24) NOT NULL DEFAULT 'vip';

ALTER TABLE corporate_english_materials
  ADD COLUMN IF NOT EXISTS tencent_video_vid VARCHAR(64),
  ADD COLUMN IF NOT EXISTS tencent_video_url TEXT,
  ADD COLUMN IF NOT EXISTS source_video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_summary TEXT,
  ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS corporate_english_clip_favorites (
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES corporate_english_clips(clip_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, clip_id)
);

CREATE INDEX IF NOT EXISTS idx_corporate_english_materials_company_sequence
  ON corporate_english_materials(company_id, sequence, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_english_clip_favorites_user
  ON corporate_english_clip_favorites(user_id, created_at DESC);
