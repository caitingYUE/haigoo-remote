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
-- Description: Support email type classification (招聘专用邮箱, 通用支持邮箱, 内部员工邮箱, 企业领导邮箱)
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT '通用支持邮箱';
ALTER TABLE trusted_companies ADD CONSTRAINT valid_email_type CHECK (email_type IN ('招聘专用邮箱', '通用支持邮箱', '内部员工邮箱', '企业领导邮箱'));
