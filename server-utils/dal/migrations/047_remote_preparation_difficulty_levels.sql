-- 2026-07-09: Add a dedicated level taxonomy for the remote preparation module.

CREATE TABLE IF NOT EXISTS corporate_english_remote_preparation_levels (
  level_key VARCHAR(24) PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT corporate_english_remote_preparation_levels_key_check
    CHECK (level_key IN ('entry', 'junior', 'intermediate', 'advanced'))
);

INSERT INTO corporate_english_remote_preparation_levels (level_key, label, sort_order, is_active)
VALUES
  ('entry', '入门', 10, TRUE),
  ('junior', '初级', 20, TRUE),
  ('intermediate', '中级', 30, TRUE),
  ('advanced', '高级', 40, TRUE)
ON CONFLICT (level_key) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(24) NOT NULL DEFAULT '';

ALTER TABLE corporate_english_module_videos
  DROP CONSTRAINT IF EXISTS corporate_english_module_videos_difficulty_level_check;

ALTER TABLE corporate_english_module_videos
  ADD CONSTRAINT corporate_english_module_videos_difficulty_level_check
  CHECK (difficulty_level = '' OR difficulty_level IN ('entry', 'junior', 'intermediate', 'advanced'));

COMMENT ON COLUMN corporate_english_module_videos.difficulty_level
  IS 'Remote preparation level: entry, junior, intermediate, advanced. Other modules should keep this empty.';

CREATE INDEX IF NOT EXISTS idx_corporate_english_module_videos_difficulty_level
  ON corporate_english_module_videos (module_key, difficulty_level)
  WHERE deleted_at IS NULL;
