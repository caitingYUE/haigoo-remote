CREATE TABLE IF NOT EXISTS deleted_account_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  reason VARCHAR(64) NOT NULL DEFAULT 'account_deletion',
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleted_account_locks_email_lower
  ON deleted_account_locks (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_deleted_account_locks_blocked_until
  ON deleted_account_locks (blocked_until DESC);
