-- 2026-04-28: User-level free entitlement limits for admin adjustment.
-- These columns store limits only. Usage history remains in existing usage columns.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_limit INTEGER;

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
