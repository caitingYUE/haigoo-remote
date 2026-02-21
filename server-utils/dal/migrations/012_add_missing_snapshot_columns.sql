-- 2026-02-21: Add missing snapshot columns and hiring_email
-- Description: Fix "column does not exist" errors in user-profile and trusted-companies APIs

-- 1. Add snapshot columns to user_job_interactions
ALTER TABLE user_job_interactions 
ADD COLUMN IF NOT EXISTS job_title_snapshot VARCHAR(255),
ADD COLUMN IF NOT EXISTS company_name_snapshot VARCHAR(255);

-- 2. Add hiring_email to trusted_companies
ALTER TABLE trusted_companies 
ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255);
