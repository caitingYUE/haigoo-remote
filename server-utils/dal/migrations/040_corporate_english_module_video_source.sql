ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS video_source TEXT NOT NULL DEFAULT '';
