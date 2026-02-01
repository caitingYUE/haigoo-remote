-- 2026-02-01: Update email_type constraint to include 'HR邮箱'
-- Description: The trusted_companies table has a CHECK constraint on email_type that needs to be updated.

-- 1. Drop the existing constraint
ALTER TABLE trusted_companies DROP CONSTRAINT IF EXISTS valid_email_type;

-- 2. Add the new constraint with 'HR邮箱'
ALTER TABLE trusted_companies ADD CONSTRAINT valid_email_type 
CHECK (email_type IN ('招聘邮箱', '通用邮箱', '员工邮箱', '高管邮箱', 'HR邮箱'));
