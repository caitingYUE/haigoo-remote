-- 2026-08-13: Scope free official/email application usage to 30-day periods
-- anchored to each user's registration timestamp.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS free_website_apply_period_key VARCHAR(40);

ALTER TABLE users
ALTER COLUMN free_website_apply_period_key TYPE VARCHAR(40);

COMMENT ON COLUMN users.free_website_apply_period_key IS
'ISO timestamp for the active 30-day application cycle, anchored to users.created_at.';

-- Preserve each existing user's current usage at cutover. The stored count and
-- job ids remain unchanged, so deploying this rule cannot grant an extra batch
-- of applications before the next registration-anchored boundary.
UPDATE users
SET free_website_apply_period_key = to_char(
  (
    created_at
    + FLOOR(GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)), 0) / 2592000) * INTERVAL '30 days'
  ) AT TIME ZONE 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
)
WHERE free_website_apply_period_key IS NULL
   OR free_website_apply_period_key !~ '^\d{4}-\d{2}-\d{2}T';

CREATE OR REPLACE FUNCTION consume_free_application_quota(
  p_user_id VARCHAR,
  p_job_id VARCHAR,
  p_period_key VARCHAR,
  p_limit INTEGER,
  p_seed_usage INTEGER DEFAULT 0,
  p_seed_job_ids JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  success BOOLEAN,
  usage INTEGER,
  unlocked_job_ids JSONB,
  period_key VARCHAR,
  already_unlocked BOOLEAN,
  limit_reached BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_ids JSONB;
  v_usage INTEGER;
  v_same_period BOOLEAN;
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_same_period := COALESCE(v_user.free_website_apply_period_key, '') = p_period_key;
  IF v_same_period THEN
    v_ids := CASE
      WHEN jsonb_typeof(v_user.free_website_apply_job_ids) = 'array'
        THEN COALESCE(v_user.free_website_apply_job_ids, '[]'::jsonb)
      ELSE '[]'::jsonb
    END;
    v_usage := GREATEST(COALESCE(v_user.free_website_apply_count, 0), jsonb_array_length(v_ids));
  ELSE
    v_ids := CASE WHEN jsonb_typeof(p_seed_job_ids) = 'array' THEN p_seed_job_ids ELSE '[]'::jsonb END;
    v_usage := GREATEST(COALESCE(p_seed_usage, 0), jsonb_array_length(v_ids));
  END IF;

  IF v_ids ? p_job_id THEN
    RETURN QUERY SELECT TRUE, v_usage, v_ids, p_period_key, TRUE, FALSE;
    RETURN;
  END IF;

  IF v_usage >= GREATEST(COALESCE(p_limit, 20), 0) THEN
    RETURN QUERY SELECT FALSE, v_usage, v_ids, p_period_key, FALSE, TRUE;
    RETURN;
  END IF;

  v_ids := v_ids || jsonb_build_array(p_job_id);
  v_usage := v_usage + 1;

  UPDATE users
  SET free_website_apply_count = v_usage,
      free_website_apply_job_ids = v_ids,
      free_website_apply_period_key = p_period_key,
      profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object(
        'preferences', COALESCE(profile->'preferences', '{}'::jsonb) || jsonb_build_object(
          'freeUsage', COALESCE(profile->'preferences'->'freeUsage', '{}'::jsonb) || jsonb_build_object(
            'websiteApply', jsonb_build_object('count', v_usage, 'unlockedJobIds', v_ids, 'periodKey', p_period_key)
          )
        )
      ),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, v_usage, v_ids, p_period_key, FALSE, FALSE;
END;
$$;
