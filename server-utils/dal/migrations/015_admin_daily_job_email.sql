-- Description: Daily admin featured job email runs and history

CREATE TABLE IF NOT EXISTS admin_daily_job_email_runs (
    id BIGSERIAL PRIMARY KEY,
    batch_date DATE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    target_count INTEGER NOT NULL DEFAULT 5,
    job_count INTEGER NOT NULL DEFAULT 0,
    featured_count INTEGER NOT NULL DEFAULT 0,
    fallback_count INTEGER NOT NULL DEFAULT 0,
    subject VARCHAR(255),
    payload JSONB,
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, recipient)
);

CREATE INDEX IF NOT EXISTS idx_admin_daily_job_email_runs_status
    ON admin_daily_job_email_runs(status, batch_date DESC);

CREATE INDEX IF NOT EXISTS idx_admin_daily_job_email_runs_recipient
    ON admin_daily_job_email_runs(recipient, batch_date DESC);

CREATE TABLE IF NOT EXISTS admin_daily_job_email_history (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES admin_daily_job_email_runs(id) ON DELETE SET NULL,
    batch_date DATE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    job_id VARCHAR(255) NOT NULL,
    source_bucket VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_date, recipient, job_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_daily_job_email_history_recent
    ON admin_daily_job_email_history(recipient, batch_date DESC);

CREATE INDEX IF NOT EXISTS idx_admin_daily_job_email_history_job
    ON admin_daily_job_email_history(job_id, batch_date DESC);
