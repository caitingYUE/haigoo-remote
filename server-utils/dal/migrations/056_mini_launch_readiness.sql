-- Launch-readiness support for the WeChat Mini Program.
-- Adds server-side abuse protection, auditable policy consent and idempotent
-- write handling. No secrets or raw client IP addresses are stored.

CREATE TABLE IF NOT EXISTS mini_rate_limits (
    key_hash VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key_hash, action)
);

CREATE INDEX IF NOT EXISTS idx_mini_rate_limits_updated_at
    ON mini_rate_limits (updated_at);

CREATE TABLE IF NOT EXISTS mini_account_consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(64) NOT NULL,
    openid VARCHAR(128) NOT NULL,
    user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
    agreement_version VARCHAR(32) NOT NULL,
    privacy_version VARCHAR(32) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, openid, agreement_version, privacy_version)
);

CREATE INDEX IF NOT EXISTS idx_mini_account_consents_user_id
    ON mini_account_consents (user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS mini_idempotency_keys (
    app_id VARCHAR(64) NOT NULL,
    openid VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (app_id, openid, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mini_idempotency_expires_at
    ON mini_idempotency_keys (expires_at);

-- Operational cleanup (run daily or from the existing maintenance job):
-- DELETE FROM mini_rate_limits WHERE updated_at < NOW() - INTERVAL '2 days';
-- DELETE FROM mini_idempotency_keys WHERE expires_at < NOW();

-- Rollback (only if the Mini Program release using these tables is reverted):
-- DROP TABLE IF EXISTS mini_idempotency_keys;
-- DROP TABLE IF EXISTS mini_account_consents;
-- DROP TABLE IF EXISTS mini_rate_limits;
