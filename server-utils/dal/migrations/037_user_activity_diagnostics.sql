-- User-level product diagnostics. Existing analytics events remain valid with null diagnostic fields.
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS event_family VARCHAR(32),
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(16),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(16),
  ADD COLUMN IF NOT EXISTS request_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS error_fingerprint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS release_version VARCHAR(80),
  ADD COLUMN IF NOT EXISTS client_context JSONB;

CREATE INDEX IF NOT EXISTS idx_analytics_user_activity_time
  ON analytics_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_request_id
  ON analytics_events(request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_error_fingerprint_time
  ON analytics_events(error_fingerprint, created_at DESC)
  WHERE error_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_failed_events_time
  ON analytics_events(created_at DESC, event_family, event_name)
  WHERE outcome IN ('failed', 'blocked');
