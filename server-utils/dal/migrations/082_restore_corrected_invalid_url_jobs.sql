-- Restore approved jobs that were deactivated for a malformed URL but now
-- contain a valid HTTP(S) application link. Explicit 404/410 closures remain untouched.

UPDATE jobs
SET status = 'active',
    url = BTRIM(url),
    last_verified_at = NULL,
    haigoo_comment = NULL,
    updated_at = NOW()
WHERE status = 'inactive'
  AND is_approved = true
  AND haigoo_comment = '[自动巡查] 判定链接彻底死亡并下线，原因: Invalid URL format'
  AND BTRIM(url) ~* '^https?://';
