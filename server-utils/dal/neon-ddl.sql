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
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS review_status VARCHAR(24) DEFAULT 'pending';
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS display_title VARCHAR(120);
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);

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

-- 6. Add index for match_score sorting
CREATE INDEX IF NOT EXISTS idx_user_job_matches_score ON user_job_matches(match_score DESC);

-- 2026-02-21: Add missing snapshot columns and hiring_email
-- 1. Add snapshot columns to user_job_interactions
ALTER TABLE user_job_interactions 
ADD COLUMN IF NOT EXISTS job_title_snapshot VARCHAR(255),
ADD COLUMN IF NOT EXISTS company_name_snapshot VARCHAR(255);

-- 2. Add hiring_email to trusted_companies
ALTER TABLE trusted_companies 
ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255);

-- 2026-02-26: Add last_verified_at for job liveliness pinging
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
UPDATE jobs SET last_verified_at = published_at WHERE last_verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_last_verified_at ON jobs(last_verified_at ASC);

-- 2026-03-13: Add referral_contacts for trusted companies
ALTER TABLE trusted_companies
ADD COLUMN IF NOT EXISTS referral_contacts JSONB DEFAULT '[]'::jsonb;

-- 2026-04-08: Add job-level referral contact mapping
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS referral_contact_mode VARCHAR(20) DEFAULT 'inherit_all';

UPDATE jobs
SET referral_contact_mode = 'inherit_all'
WHERE referral_contact_mode IS NULL;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_referral_contact_mode_check;
ALTER TABLE jobs
ADD CONSTRAINT jobs_referral_contact_mode_check
CHECK (referral_contact_mode IN ('inherit_all', 'custom'));

CREATE TABLE IF NOT EXISTS job_referral_contact_links (
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    company_id VARCHAR(255) NOT NULL REFERENCES trusted_companies(company_id) ON DELETE CASCADE,
    contact_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (job_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_job_referral_contact_links_job_id
    ON job_referral_contact_links(job_id);

CREATE INDEX IF NOT EXISTS idx_job_referral_contact_links_company_id
    ON job_referral_contact_links(company_id);

-- 2026-04-28: User-level free entitlement limits for admin adjustment
ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_limit INTEGER;
ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_period_key VARCHAR(40);

ALTER TABLE users
ALTER COLUMN free_website_apply_period_key TYPE VARCHAR(40);

UPDATE users
SET free_website_apply_period_key = to_char(
  (created_at + FLOOR(GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)), 0) / 2592000) * INTERVAL '30 days') AT TIME ZONE 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
)
WHERE free_website_apply_period_key IS NULL
   OR free_website_apply_period_key !~ '^\d{4}-\d{2}-\d{2}T';

CREATE OR REPLACE FUNCTION consume_free_application_quota(
  p_user_id VARCHAR,
  p_job_id VARCHAR,
  p_period_key VARCHAR,
  p_limit INTEGER,
  p_seed_usage INTEGER DEFAULT 0,
  p_seed_job_ids JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (success BOOLEAN, usage INTEGER, unlocked_job_ids JSONB, period_key VARCHAR, already_unlocked BOOLEAN, limit_reached BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE v_user users%ROWTYPE; v_ids JSONB; v_usage INTEGER; v_same_period BOOLEAN;
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  v_same_period := COALESCE(v_user.free_website_apply_period_key, '') = p_period_key;
  IF v_same_period THEN
    v_ids := CASE WHEN jsonb_typeof(v_user.free_website_apply_job_ids) = 'array' THEN COALESCE(v_user.free_website_apply_job_ids, '[]'::jsonb) ELSE '[]'::jsonb END;
    v_usage := GREATEST(COALESCE(v_user.free_website_apply_count, 0), jsonb_array_length(v_ids));
  ELSE
    v_ids := CASE WHEN jsonb_typeof(p_seed_job_ids) = 'array' THEN p_seed_job_ids ELSE '[]'::jsonb END;
    v_usage := GREATEST(COALESCE(p_seed_usage, 0), jsonb_array_length(v_ids));
  END IF;
  IF v_ids ? p_job_id THEN RETURN QUERY SELECT TRUE, v_usage, v_ids, p_period_key, TRUE, FALSE; RETURN; END IF;
  IF v_usage >= GREATEST(COALESCE(p_limit, 20), 0) THEN RETURN QUERY SELECT FALSE, v_usage, v_ids, p_period_key, FALSE, TRUE; RETURN; END IF;
  v_ids := v_ids || jsonb_build_array(p_job_id); v_usage := v_usage + 1;
  UPDATE users SET free_website_apply_count = v_usage, free_website_apply_job_ids = v_ids, free_website_apply_period_key = p_period_key,
    profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('preferences', COALESCE(profile->'preferences', '{}'::jsonb) || jsonb_build_object('freeUsage', COALESCE(profile->'preferences'->'freeUsage', '{}'::jsonb) || jsonb_build_object('websiteApply', jsonb_build_object('count', v_usage, 'unlockedJobIds', v_ids, 'periodKey', p_period_key)))), updated_at = NOW()
  WHERE user_id = p_user_id;
  RETURN QUERY SELECT TRUE, v_usage, v_ids, p_period_key, FALSE, FALSE;
END;
$$;

CREATE TABLE IF NOT EXISTS membership_notification_log (
  event_key VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_notification_log_user_event
ON membership_notification_log(user_id, event_type, created_at DESC);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_referral_limit INTEGER;

ALTER TABLE users
ALTER COLUMN free_website_apply_limit SET DEFAULT 20;

ALTER TABLE users
ALTER COLUMN free_referral_limit SET DEFAULT 3;

UPDATE users
SET free_website_apply_limit = 20
WHERE free_website_apply_limit IS NULL;

UPDATE users
SET free_referral_limit = 3
WHERE free_referral_limit IS NULL;

ALTER TABLE users
ALTER COLUMN free_website_apply_limit SET NOT NULL;

ALTER TABLE users
ALTER COLUMN free_referral_limit SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_free_website_apply_limit_nonnegative'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_free_website_apply_limit_nonnegative
        CHECK (free_website_apply_limit >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_free_referral_limit_nonnegative'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_free_referral_limit_nonnegative
        CHECK (free_referral_limit >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_user_entitlement_audit (
    id BIGSERIAL PRIMARY KEY,
    target_user_id VARCHAR(255) NOT NULL,
    admin_user_id VARCHAR(255) NOT NULL,
    entitlement_key VARCHAR(64) NOT NULL CHECK (entitlement_key IN ('website_apply', 'referral')),
    old_limit INTEGER NOT NULL,
    new_limit INTEGER NOT NULL,
    old_usage INTEGER NOT NULL,
    new_remaining INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_entitlement_audit_target_user
ON admin_user_entitlement_audit(target_user_id, created_at DESC);

-- 2026-06-04: Ensure membership payment records support manual claim metadata.
CREATE TABLE IF NOT EXISTS payment_records (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    amount NUMERIC,
    currency VARCHAR(16) DEFAULT 'CNY',
    payment_method VARCHAR(64),
    status VARCHAR(64) DEFAULT 'pending',
    plan_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payment_records
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE payment_records
    ADD COLUMN IF NOT EXISTS provider VARCHAR(64),
    ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS app_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS openid VARCHAR(128),
    ADD COLUMN IF NOT EXISTS product_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS expected_amount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS callback_received_at TIMESTAMPTZ;
