-- Canonical notes shared by the website career-learning editor and Mini Program.

CREATE TABLE IF NOT EXISTS career_growth_notes (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_type VARCHAR(16) NOT NULL,
  source_video_id UUID UNIQUE REFERENCES corporate_english_module_videos(video_id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  original_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  rights_basis VARCHAR(32) NOT NULL DEFAULT '',
  rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  rights_confirmed_by VARCHAR(255),
  rights_confirmed_at TIMESTAMPTZ,
  content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT '',
  difficulty_level VARCHAR(24) NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_tier VARCHAR(24) NOT NULL DEFAULT 'vip',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cover_image_hash TEXT,
  cover_image_width INTEGER,
  cover_image_height INTEGER,
  cover_image_updated_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT career_growth_notes_origin_check
    CHECK (origin_type IN ('video', 'original', 'external')),
  CONSTRAINT career_growth_notes_video_link_check
    CHECK ((origin_type = 'video' AND source_video_id IS NOT NULL)
      OR (origin_type <> 'video' AND source_video_id IS NULL)),
  CONSTRAINT career_growth_notes_content_check CHECK (jsonb_typeof(content_blocks) = 'array'),
  CONSTRAINT career_growth_notes_tags_check CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT career_growth_notes_access_check CHECK (access_tier IN ('free', 'vip')),
  CONSTRAINT career_growth_notes_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT career_growth_notes_difficulty_check
    CHECK (difficulty_level = '' OR difficulty_level IN ('entry', 'junior', 'intermediate', 'advanced')),
  CONSTRAINT career_growth_notes_version_check CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_career_growth_notes_public
  ON career_growth_notes(status, is_featured DESC, sort_order ASC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_growth_notes_origin
  ON career_growth_notes(origin_type, updated_at DESC);

ALTER TABLE corporate_english_cover_assets
  DROP CONSTRAINT IF EXISTS corporate_english_cover_assets_owner_check;
ALTER TABLE corporate_english_cover_assets
  ADD CONSTRAINT corporate_english_cover_assets_owner_check
  CHECK (owner_type IN ('material', 'module_video', 'growth_note'));

WITH source_notes AS (
  SELECT video.*,
         COALESCE(
           NULLIF(BTRIM(to_jsonb(video)->>'title_zh'), ''),
           (
             SELECT NULLIF(BTRIM(block->>'text'), '')
               FROM jsonb_array_elements(video.video_notes) AS block
              WHERE block->>'type' IN ('heading_1', 'heading_2')
                AND NULLIF(BTRIM(block->>'text'), '') IS NOT NULL
              LIMIT 1
           ),
           video.video_title
         ) AS note_title
    FROM corporate_english_module_videos AS video
   WHERE video.module_key = 'remote_preparation'
     AND video.deleted_at IS NULL
     AND jsonb_typeof(video.video_notes) = 'array'
     AND jsonb_array_length(video.video_notes) > 0
)
INSERT INTO career_growth_notes (
  note_id, origin_type, source_video_id, title, original_title, summary,
  author_name, source_name, rights_basis, rights_confirmed,
  content_blocks, category, difficulty_level, tags, access_tier, status,
  is_featured, sort_order, published_at,
  cover_image_hash, cover_image_width, cover_image_height, cover_image_updated_at,
  created_by, updated_by, created_at, updated_at
)
SELECT
  video_id, 'video', video_id, note_title, video_title, description,
  'Haigoo 职业研究', video_source, 'linked_video', TRUE,
  video_notes, '远程职业准备', difficulty_level, tags, access_tier, status,
  is_featured, sort_order, published_at,
  cover_image_hash, cover_image_width, cover_image_height, cover_image_updated_at,
  created_by, updated_by, created_at, updated_at
FROM source_notes
ON CONFLICT (note_id) DO NOTHING;

