-- Reconcile legacy/partial databases with the schema required by Mini Program
-- virtual payments and account lifecycle APIs.
--
-- Some environments created payment_records before migration 028 was tracked.
-- Migration 059 intentionally added only provider-specific columns, so those
-- environments can still be missing the metadata snapshot used to validate a
-- payment callback. Keep this migration idempotent so it is safe in Preview and
-- Production.

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE payment_records
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

COMMENT ON COLUMN payment_records.metadata IS
  'Immutable order metadata and verified provider callback snapshots.';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_type VARCHAR(32) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS member_cycle_start_at TIMESTAMP NULL;

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

-- Rollback is deliberately omitted. All changes are additive compatibility
-- columns/tables and may already be used by account or payment records.
