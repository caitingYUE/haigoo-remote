-- 2026-07-03: Member subscription digest runs and per-job delivery history
-- Tracks daily subscription email batches and prevents same-week job repeats.

CREATE TABLE IF NOT EXISTS subscription_digest_runs (
    id BIGSERIAL PRIMARY KEY,
    subscription_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    identifier VARCHAR(255) NOT NULL,
    batch_date DATE NOT NULL,
    week_key VARCHAR(32) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    job_count INTEGER NOT NULL DEFAULT 0,
    primary_count INTEGER NOT NULL DEFAULT 0,
    related_count INTEGER NOT NULL DEFAULT 0,
    subject VARCHAR(255),
    payload JSONB,
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, subscription_id)
);

ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS batch_date DATE;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS week_key VARCHAR(32);
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai';
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'processing';
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS job_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS primary_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS related_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscription_digest_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE subscription_digest_runs SET timezone = 'Asia/Shanghai' WHERE timezone IS NULL OR timezone = '';
UPDATE subscription_digest_runs SET status = 'processing' WHERE status IS NULL OR status = '';
UPDATE subscription_digest_runs SET job_count = 0 WHERE job_count IS NULL;
UPDATE subscription_digest_runs SET primary_count = 0 WHERE primary_count IS NULL;
UPDATE subscription_digest_runs SET related_count = 0 WHERE related_count IS NULL;
UPDATE subscription_digest_runs
SET week_key = ((batch_date - ((EXTRACT(ISODOW FROM batch_date)::int - 1) * INTERVAL '1 day'))::date)::text
WHERE week_key IS NULL AND batch_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_digest_runs_batch_subscription_unique
    ON subscription_digest_runs(batch_date, subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_digest_runs_subscription_week
    ON subscription_digest_runs(subscription_id, week_key, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_digest_runs_status_date
    ON subscription_digest_runs(status, batch_date DESC);

CREATE TABLE IF NOT EXISTS subscription_digest_items (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES subscription_digest_runs(id) ON DELETE SET NULL,
    subscription_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    identifier VARCHAR(255) NOT NULL,
    batch_date DATE NOT NULL,
    week_key VARCHAR(32) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    match_tier VARCHAR(32) NOT NULL,
    match_score INTEGER NOT NULL DEFAULT 0,
    matched_topic TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, job_id, week_key)
);

ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS run_id BIGINT;
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS batch_date DATE;
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS week_key VARCHAR(32);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS job_id VARCHAR(255);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS match_tier VARCHAR(32);
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS match_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS matched_topic TEXT;
ALTER TABLE subscription_digest_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE subscription_digest_items SET match_tier = 'primary' WHERE match_tier IS NULL OR match_tier = '';
UPDATE subscription_digest_items SET match_score = 0 WHERE match_score IS NULL;
UPDATE subscription_digest_items
SET week_key = ((batch_date - ((EXTRACT(ISODOW FROM batch_date)::int - 1) * INTERVAL '1 day'))::date)::text
WHERE week_key IS NULL AND batch_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_digest_items_week_job_unique
    ON subscription_digest_items(subscription_id, job_id, week_key);

CREATE INDEX IF NOT EXISTS idx_subscription_digest_items_subscription_week
    ON subscription_digest_items(subscription_id, week_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_digest_items_job
    ON subscription_digest_items(job_id, created_at DESC);
