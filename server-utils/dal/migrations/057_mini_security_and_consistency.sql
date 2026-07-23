-- Mini Program security and consistency hardening.
--
-- 1. Keep password-reset credentials separate from email-verification tokens.
-- 2. Serialize the free-user browse allowance per WeChat identity so concurrent
--    list/search/detail requests cannot collectively exceed 100 unique jobs.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token
    ON users (reset_token)
    WHERE reset_token IS NOT NULL;

CREATE OR REPLACE FUNCTION consume_mini_job_views(
    p_app_id VARCHAR,
    p_openid VARCHAR,
    p_job_ids TEXT[],
    p_limit INTEGER DEFAULT 100
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    requested_job_id TEXT;
    allowed_job_ids TEXT[] := ARRAY[]::TEXT[];
    current_count INTEGER := 0;
    safe_limit INTEGER := GREATEST(0, LEAST(COALESCE(p_limit, 100), 10000));
BEGIN
    -- A transaction-scoped lock makes the count/insert decision atomic for one
    -- identity, while allowing different users to browse concurrently.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_app_id || ':' || p_openid, 0));

    SELECT COUNT(*)::INTEGER
      INTO current_count
      FROM mini_job_views
     WHERE app_id = p_app_id
       AND openid = p_openid;

    FOREACH requested_job_id IN ARRAY COALESCE(p_job_ids, ARRAY[]::TEXT[])
    LOOP
        requested_job_id := BTRIM(COALESCE(requested_job_id, ''));
        IF requested_job_id = '' OR requested_job_id = ANY(allowed_job_ids) THEN
            CONTINUE;
        END IF;

        IF EXISTS (
            SELECT 1
              FROM mini_job_views
             WHERE app_id = p_app_id
               AND openid = p_openid
               AND job_id = requested_job_id
        ) THEN
            UPDATE mini_job_views
               SET last_viewed_at = NOW()
             WHERE app_id = p_app_id
               AND openid = p_openid
               AND job_id = requested_job_id;
            allowed_job_ids := array_append(allowed_job_ids, requested_job_id);
        ELSIF current_count < safe_limit THEN
            INSERT INTO mini_job_views (
                app_id, openid, job_id, first_viewed_at, last_viewed_at
            ) VALUES (
                p_app_id, p_openid, requested_job_id, NOW(), NOW()
            )
            ON CONFLICT (app_id, openid, job_id)
            DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at;
            current_count := current_count + 1;
            allowed_job_ids := array_append(allowed_job_ids, requested_job_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'allowedJobIds', to_jsonb(allowed_job_ids),
        'viewedCount', current_count,
        'remaining', GREATEST(0, safe_limit - current_count),
        'limited', current_count >= safe_limit
    );
END;
$$;

-- Rollback (only after reverting all callers):
-- DROP FUNCTION IF EXISTS consume_mini_job_views(VARCHAR, VARCHAR, TEXT[], INTEGER);
-- DROP INDEX IF EXISTS idx_users_reset_token;
-- ALTER TABLE users DROP COLUMN IF EXISTS reset_expires;
-- ALTER TABLE users DROP COLUMN IF EXISTS reset_token;
