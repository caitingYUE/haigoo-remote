-- Mini Program 1.0 content, consultation and licensed-audio support.
-- Additive only: existing job, membership and CRM records are unchanged.

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

COMMENT ON COLUMN corporate_learning_audio_assets.cloud_file_id IS
  'CloudBase cloud:// file ID. Public third-party URLs must never be stored or returned as playable audio.';
COMMENT ON COLUMN corporate_learning_audio_assets.authorization_reference IS
  'Internal evidence reference for owned or licensed distribution rights; never exposed to clients.';
