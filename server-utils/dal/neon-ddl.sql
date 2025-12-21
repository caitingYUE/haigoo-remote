-- 2025-12-22: Update bug_reports table
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS contact_info TEXT;
