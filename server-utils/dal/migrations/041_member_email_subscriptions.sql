-- 2026-07-03: Member email job subscriptions
-- Restores the unified email subscription table used by member job digests.

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    identifier VARCHAR(255) NOT NULL,
    topic TEXT,
    nickname VARCHAR(255),
    preferences JSONB DEFAULT '{}'::jsonb,
    channel VARCHAR(32) NOT NULL DEFAULT 'email',
    frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ,
    fail_count INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS channel VARCHAR(32) NOT NULL DEFAULT 'email';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS frequency VARCHAR(32) NOT NULL DEFAULT 'daily';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS fail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

UPDATE subscriptions SET preferences = '{}'::jsonb WHERE preferences IS NULL;
UPDATE subscriptions SET channel = 'email' WHERE channel IS NULL OR channel = '';
UPDATE subscriptions SET frequency = 'daily' WHERE frequency IS NULL OR frequency = '';
UPDATE subscriptions SET status = 'active' WHERE status IS NULL OR status = '';
UPDATE subscriptions SET fail_count = 0 WHERE fail_count IS NULL;

CREATE SEQUENCE IF NOT EXISTS subscriptions_subscription_id_seq;
SELECT setval(
    'subscriptions_subscription_id_seq',
    GREATEST(COALESCE((
        SELECT MAX(subscription_id::text::bigint)
        FROM subscriptions
        WHERE subscription_id::text ~ '^[0-9]{1,18}$'
    ), 0), 1),
    true
);

DO $$
DECLARE
    subscription_id_type TEXT;
BEGIN
    SELECT data_type INTO subscription_id_type
    FROM information_schema.columns
    WHERE table_name = 'subscriptions'
      AND column_name = 'subscription_id';

    IF subscription_id_type IN ('bigint', 'integer', 'numeric') THEN
        ALTER TABLE subscriptions
            ALTER COLUMN subscription_id SET DEFAULT nextval('subscriptions_subscription_id_seq');
    ELSE
        ALTER TABLE subscriptions
            ALTER COLUMN subscription_id SET DEFAULT (nextval('subscriptions_subscription_id_seq'))::text;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_channel_unique
    ON subscriptions(user_id, channel)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_identifier_channel
    ON subscriptions(LOWER(identifier), channel);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_channel
    ON subscriptions(status, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_topic
    ON subscriptions USING gin (to_tsvector('simple', COALESCE(topic, '')));
