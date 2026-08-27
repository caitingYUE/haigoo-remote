-- The posting previously returned HTTP 410 but is accepting applications again.
-- Restore only the verified record; other HTTP 404/410 closures remain untouched.

UPDATE jobs
SET status = 'active',
    last_verified_at = NULL,
    haigoo_comment = NULL,
    updated_at = NOW()
WHERE job_id = 'Climate & Carbon Lead-Preferred by Nature-1778659823924'
  AND status = 'inactive'
  AND is_approved = true
  AND haigoo_comment = '[自动巡查] 判定链接彻底死亡并下线，原因: HTTP 410';
