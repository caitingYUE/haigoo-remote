CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS corporate_english_module_videos (
  video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key VARCHAR(32) NOT NULL,
  video_title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tencent_iframe_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_tier VARCHAR(24) NOT NULL DEFAULT 'vip',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT corporate_english_module_videos_module_check
    CHECK (module_key IN ('english_interview', 'remote_preparation', 'foreign_meeting')),
  CONSTRAINT corporate_english_module_videos_access_tier_check
    CHECK (access_tier IN ('free', 'vip')),
  CONSTRAINT corporate_english_module_videos_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT corporate_english_module_videos_tags_array_check
    CHECK (jsonb_typeof(tags) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_public
  ON corporate_english_module_videos (module_key, status, published_at DESC, sort_order ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_category
  ON corporate_english_module_videos (module_key, category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_tags
  ON corporate_english_module_videos USING GIN (tags);
