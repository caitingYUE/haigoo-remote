
-- Add translation usage tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_translation_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_translation_date DATE;
