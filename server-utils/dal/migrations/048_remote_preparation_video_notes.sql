-- 2026-07-12: Add structured long-form notes to remote preparation videos.

ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS video_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE corporate_english_module_videos
  DROP CONSTRAINT IF EXISTS corporate_english_module_videos_video_notes_array_check;

ALTER TABLE corporate_english_module_videos
  ADD CONSTRAINT corporate_english_module_videos_video_notes_array_check
  CHECK (jsonb_typeof(video_notes) = 'array');

COMMENT ON COLUMN corporate_english_module_videos.video_notes
  IS 'Structured video-note blocks for remote preparation courses. Supported types: heading_1, heading_2, paragraph, bullet_list, numbered_list, quote.';
