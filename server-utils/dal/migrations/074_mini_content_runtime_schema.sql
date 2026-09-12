-- Runtime schema required by the Mini Program 1.0 content surfaces.
-- Additive and idempotent so older Preview databases can catch up without
-- importing the full corporate-English administration schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS corporate_english_module_videos (
  video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key VARCHAR(32) NOT NULL,
  video_title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tencent_iframe_url TEXT NOT NULL DEFAULT '',
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
  video_source TEXT NOT NULL DEFAULT '',
  cover_image_hash TEXT,
  cover_image_width INTEGER,
  cover_image_height INTEGER,
  cover_image_updated_at TIMESTAMPTZ,
  duration_ms INTEGER,
  difficulty_level VARCHAR(24) NOT NULL DEFAULT '',
  video_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT corporate_english_module_videos_module_check
    CHECK (module_key IN ('english_interview', 'remote_preparation', 'foreign_meeting')),
  CONSTRAINT corporate_english_module_videos_access_tier_check
    CHECK (access_tier IN ('free', 'vip')),
  CONSTRAINT corporate_english_module_videos_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT corporate_english_module_videos_tags_array_check
    CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT corporate_english_module_videos_video_notes_array_check
    CHECK (jsonb_typeof(video_notes) = 'array'),
  CONSTRAINT corporate_english_module_videos_difficulty_level_check
    CHECK (difficulty_level = '' OR difficulty_level IN ('entry', 'junior', 'intermediate', 'advanced'))
);

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_public
  ON corporate_english_module_videos (module_key, status, published_at DESC, sort_order ASC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_featured
  ON corporate_english_module_videos (is_featured, published_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE TABLE IF NOT EXISTS member_crm_consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  consultation_topic VARCHAR(64) NOT NULL,
  wechat_id VARCHAR(64) NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  source_page VARCHAR(64) NOT NULL DEFAULT 'mini_consultation',
  source_content_id VARCHAR(255),
  source_company_id VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  assigned_to VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT member_crm_consultation_topic_check CHECK (
    consultation_topic IN ('career_direction', 'resume', 'remote_search', 'interview', 'membership', 'other')
  ),
  CONSTRAINT member_crm_consultation_status_check CHECK (
    status IN ('pending', 'contacted', 'scheduled', 'completed', 'closed')
  ),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_member_crm_consultation_pending
  ON member_crm_consultation_requests(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_member_crm_consultation_user
  ON member_crm_consultation_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS corporate_learning_audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES corporate_english_module_videos(video_id) ON DELETE CASCADE,
  cloud_file_id TEXT NOT NULL,
  duration_seconds INTEGER,
  rights_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  rights_holder TEXT NOT NULL DEFAULT '',
  authorization_reference TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  updated_by VARCHAR(255) REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_learning_audio_rights_check CHECK (
    rights_status IN ('pending', 'owned', 'licensed', 'rejected', 'expired')
  ),
  CONSTRAINT corporate_learning_audio_status_check CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT corporate_learning_audio_duration_check CHECK (
    duration_seconds IS NULL OR duration_seconds > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_corporate_learning_audio_published
  ON corporate_learning_audio_assets(video_id)
  WHERE status = 'published';
