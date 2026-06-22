ALTER TABLE corporate_english_clips
  ADD COLUMN IF NOT EXISTS pronunciation_marks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_corporate_english_clips_pronunciation_marks
  ON corporate_english_clips USING GIN (pronunciation_marks);
