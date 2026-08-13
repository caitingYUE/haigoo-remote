-- 2026-08-13: Persist membership lifecycle email/in-app notification idempotency.
--
-- The application keeps a runtime CREATE TABLE fallback for partially migrated
-- environments. This migration makes the table an explicit deployment step so
-- production requests do not need DDL privileges or perform schema work.

CREATE TABLE IF NOT EXISTS membership_notification_log (
  event_key VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_notification_log_user_event
  ON membership_notification_log(user_id, event_type, created_at DESC);

COMMENT ON TABLE membership_notification_log IS
  'Idempotency ledger for membership activation and expiry notifications.';
