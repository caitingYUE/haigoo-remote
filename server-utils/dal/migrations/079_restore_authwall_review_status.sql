-- Restore active jobs incorrectly unapproved because the verifier was blocked by an auth wall.
UPDATE jobs
SET is_approved = TRUE,
    haigoo_comment = '[自动巡查] 401/403/Authwall 无法证明岗位失效，已恢复审核状态',
    updated_at = NOW()
WHERE status = 'active'
  AND is_approved IS NOT TRUE
  AND haigoo_comment IN (
    '[自动巡查] 触发模糊风控转为待审核，原因: Blocked or Authwall (HTTP 401)',
    '[自动巡查] 触发模糊风控转为待审核，原因: Blocked or Authwall (HTTP 403)'
  );
