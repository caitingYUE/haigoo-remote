-- Description: Queue for Enterprise WeCom aibot approved-job push tasks

CREATE TABLE IF NOT EXISTS wecom_aibot_push_queue (
    id BIGSERIAL PRIMARY KEY,
    channel VARCHAR(50) NOT NULL DEFAULT 'wecom_aibot',
    event_type VARCHAR(50) NOT NULL DEFAULT 'job_approved',
    job_id VARCHAR(255),
    dedupe_key VARCHAR(255) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    response JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wecom_aibot_push_queue_status_available
    ON wecom_aibot_push_queue(status, available_at);

CREATE INDEX IF NOT EXISTS idx_wecom_aibot_push_queue_job_id
    ON wecom_aibot_push_queue(job_id);

CREATE INDEX IF NOT EXISTS idx_wecom_aibot_push_queue_created_at
    ON wecom_aibot_push_queue(created_at DESC);
