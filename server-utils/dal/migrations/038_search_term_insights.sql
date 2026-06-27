CREATE INDEX IF NOT EXISTS idx_analytics_search_terms_time
  ON analytics_events ((properties->>'search_term_group'), created_at DESC)
  WHERE COALESCE(event_family, properties->>'event_family') = 'search'
    AND properties ? 'search_term_group';

CREATE INDEX IF NOT EXISTS idx_analytics_search_empty_time
  ON analytics_events (created_at DESC)
  WHERE COALESCE(event_family, properties->>'event_family') = 'search'
    AND event_name = 'search_empty';
