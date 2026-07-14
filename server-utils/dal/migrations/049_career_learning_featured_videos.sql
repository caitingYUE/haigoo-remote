-- 2026-07-13: Allow career-learning videos to be curated for the homepage.

ALTER TABLE corporate_english_materials
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_corporate_english_materials_featured
  ON corporate_english_materials (is_featured, published_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_featured
  ON corporate_english_module_videos (is_featured, published_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

COMMENT ON COLUMN corporate_english_materials.is_featured
  IS 'Whether this CEO interview is curated for the homepage career-learning section.';

COMMENT ON COLUMN corporate_english_module_videos.is_featured
  IS 'Whether this module video is curated for the homepage career-learning section.';
