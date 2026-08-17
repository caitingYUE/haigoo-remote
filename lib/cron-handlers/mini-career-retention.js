import neonHelper from '../../server-utils/dal/neon-helper.js'

export default async function miniCareerRetentionHandler(_req, res) {
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })
  await neonHelper.query(
    `DELETE FROM mini_match_exposures
      WHERE user_id IN (
        SELECT user_id FROM mini_career_profiles
         WHERE expires_at IS NOT NULL AND expires_at <= NOW()
      )`
  )
  const rows = await neonHelper.query(
    `WITH expired AS (
       DELETE FROM mini_career_profiles
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()
       RETURNING user_id, retention_policy, expires_at, privacy_version
     ), audited AS (
       INSERT INTO mini_career_privacy_events
         (user_id, action, retention_policy, expires_at, privacy_version, metadata)
       SELECT user_id, 'retention_expired', retention_policy, expires_at, privacy_version, '{}'::jsonb
         FROM expired
       RETURNING event_id
     )
     SELECT (SELECT COUNT(*)::int FROM expired) AS deleted_count,
            (SELECT COUNT(*)::int FROM audited) AS audited_count`
  )
  return res.status(200).json({ success: true, deleted: Number(rows?.[0]?.deleted_count || 0), audited: Number(rows?.[0]?.audited_count || 0) })
}
