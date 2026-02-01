-- 2026-01-18: Performance Optimization for Company Detail Page
-- Add index on jobs(company_id) to speed up job fetching by ID
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- Add index on jobs(company) for faster text search (if fallback needed)
-- Using LOWER() for case-insensitive matching which is common in ILIKE or manual lower() comparisons
CREATE INDEX IF NOT EXISTS idx_jobs_company_lower ON jobs(lower(company));

-- Add index on trusted_companies(name) for faster lookup
CREATE INDEX IF NOT EXISTS idx_trusted_companies_name_lower ON trusted_companies(lower(name));

-- Add index on extracted_companies(name) for faster union queries
CREATE INDEX IF NOT EXISTS idx_extracted_companies_name_lower ON extracted_companies(lower(name));

-- 2026-01-18: Add email_type to trusted_companies
-- Description: Support email type classification (招聘邮箱, 通用邮箱, 员工邮箱, 高管邮箱, HR邮箱)
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT '通用邮箱';
-- Note: Need to update existing data and constraint manually in DB console:
-- 1. DROP CONSTRAINT valid_email_type;
-- 2. UPDATE trusted_companies SET email_type = '招聘邮箱' WHERE email_type = '招聘专用邮箱';
-- 3. UPDATE trusted_companies SET email_type = '通用邮箱' WHERE email_type = '通用支持邮箱';
-- 4. UPDATE trusted_companies SET email_type = '员工邮箱' WHERE email_type = '内部员工邮箱';
-- 5. UPDATE trusted_companies SET email_type = '高管邮箱' WHERE email_type = '企业领导邮箱';
-- 6. ALTER TABLE trusted_companies ADD CONSTRAINT valid_email_type CHECK (email_type IN ('招聘邮箱', '通用邮箱', '员工邮箱', '高管邮箱', 'HR邮箱'));

-- 2026-01-21: Add recruitment request fields to feedbacks table
-- Description: Store company info for "I want to recruit" requests
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS company_website VARCHAR(255);
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS recruitment_needs TEXT;

-- 2026-01-27: Optimize Trusted Companies Page Loading
-- Add indexes for common sort and filter columns
CREATE INDEX IF NOT EXISTS idx_trusted_companies_updated_at ON trusted_companies(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trusted_companies_industry ON trusted_companies(industry);
CREATE INDEX IF NOT EXISTS idx_trusted_companies_source ON trusted_companies(source);
