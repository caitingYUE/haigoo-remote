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

-- 2026-02-02: Unified Subscription System
-- Description: Add preferences column to subscriptions table to store detailed job tracking criteria
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS preferences JSONB;

-- 2026-02-19: Remote Work Copilot
-- Description: Store user copilot sessions and ensure resume URL in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url VARCHAR(1024);
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_copilot_trial BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS copilot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    goal VARCHAR(50), -- 'full-time', 'part-time', 'freelance'
    timeline VARCHAR(50), -- 'immediately', '1-3 months', etc.
    background JSONB, -- { education, industry, seniority, language }
    plan_data JSONB, -- Generated AI plan
    is_trial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_id ON copilot_sessions(user_id);

-- 2026-02-20: Fix Missing Columns and Tables
-- Description: Add missing job_bundles table and columns for favorites snapshots and hiring email

-- 1. Job Bundles
CREATE TABLE IF NOT EXISTS job_bundles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    content TEXT,
    job_ids JSONB DEFAULT '[]',
    priority INT DEFAULT 10,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Favorites Snapshots
ALTER TABLE user_job_interactions ADD COLUMN IF NOT EXISTS job_title_snapshot VARCHAR(255);
ALTER TABLE user_job_interactions ADD COLUMN IF NOT EXISTS company_name_snapshot VARCHAR(255);

-- 3. Trusted Companies Hiring Email
ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255);
