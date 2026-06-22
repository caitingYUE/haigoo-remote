-- Store clip-relative subtitle timestamps for synced script highlighting.
ALTER TABLE corporate_english_clips
  ADD COLUMN IF NOT EXISTS subtitle_cues JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN corporate_english_clips.subtitle_cues IS
  'Clip-relative subtitle cues: [{startMs,endMs,subtitleText,translationText}]';
