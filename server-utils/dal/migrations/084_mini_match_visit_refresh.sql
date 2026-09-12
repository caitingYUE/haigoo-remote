-- Apply before deploying the visit-refresh gateway. No user data is deleted.
ALTER TABLE career_watch_feed_snapshots
  ADD COLUMN IF NOT EXISTS fixed_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fixed_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_match_batches JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Preserve existing original snapshots. If an older installation never stored
-- one, freeze its last saved result and its actual timestamp as the recoverable
-- baseline; do not label a later member result with the first-use date.
UPDATE career_watch_feed_snapshots snapshots
   SET fixed_recommendations = CASE
         WHEN jsonb_array_length(snapshots.fixed_recommendations) = 0 THEN snapshots.recommendations
         ELSE snapshots.fixed_recommendations END,
       fixed_generated_at = COALESCE(snapshots.fixed_generated_at, CASE
         WHEN jsonb_array_length(snapshots.fixed_recommendations) > 0 THEN entitlements.free_assessment_used_at
         ELSE snapshots.generated_at END)
  FROM mini_career_entitlements entitlements
 WHERE snapshots.user_id = entitlements.user_id
   AND entitlements.free_assessment_used_at IS NOT NULL
   AND (snapshots.fixed_generated_at IS NULL OR jsonb_array_length(snapshots.fixed_recommendations) = 0);
