ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS page_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS module VARCHAR(64),
  ADD COLUMN IF NOT EXISTS feature_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS flow_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS user_segment VARCHAR(32),
  ADD COLUMN IF NOT EXISTS membership_state VARCHAR(32);

UPDATE analytics_events
SET event_id = gen_random_uuid()
WHERE event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_event_id
  ON analytics_events(event_id);

CREATE INDEX IF NOT EXISTS idx_analytics_created_actor
  ON analytics_events(created_at, user_id, anonymous_id);

CREATE INDEX IF NOT EXISTS idx_analytics_feature_time
  ON analytics_events(feature_key, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_page_time
  ON analytics_events(page_key, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_flow_time
  ON analytics_events(flow_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_user_segment_time
  ON analytics_events(user_segment, membership_state, created_at);
