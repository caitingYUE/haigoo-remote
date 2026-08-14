-- Restore approved email-only jobs that the URL verifier incorrectly marked inactive.
-- This leaves member_only unchanged, so Club visibility remains independent.

WITH eligible_jobs AS (
  SELECT DISTINCT j.job_id
  FROM jobs j
  JOIN trusted_companies tc
    ON j.company_id = tc.company_id
    OR (
      j.company_id IS NULL
      AND LOWER(BTRIM(j.company)) = LOWER(BTRIM(tc.name))
    )
  WHERE j.status = 'inactive'
    AND j.is_approved = true
    AND NULLIF(BTRIM(j.url), '') IS NULL
    AND NULLIF(BTRIM(tc.hiring_email), '') IS NOT NULL
    AND j.haigoo_comment = '[自动巡查] 判定链接彻底死亡并下线，原因: Invalid URL format'
), restored_jobs AS (
  UPDATE jobs j
  SET status = 'active',
      last_verified_at = NULL,
      haigoo_comment = NULL,
      updated_at = NOW()
  FROM eligible_jobs eligible
  WHERE j.job_id = eligible.job_id
  RETURNING j.job_id, j.title, j.company, j.member_only
)
SELECT * FROM restored_jobs ORDER BY company, title;
