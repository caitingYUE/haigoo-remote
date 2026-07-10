-- 2026-07-09: Add remote preparation module to corporate English module videos.

ALTER TABLE corporate_english_module_videos
  DROP CONSTRAINT IF EXISTS corporate_english_module_videos_module_check;

ALTER TABLE corporate_english_module_videos
  ADD CONSTRAINT corporate_english_module_videos_module_check
  CHECK (module_key IN ('english_interview', 'remote_preparation', 'foreign_meeting'));
