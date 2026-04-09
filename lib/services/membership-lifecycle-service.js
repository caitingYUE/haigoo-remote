import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  buildMembershipExpiredEventKeySql,
  ensureMembershipNotificationLogTable,
  notifyMembershipExpired
} from './membership-notification-service.js'

function hydrateUserRecord(user) {
  if (!user) return null
  const hydrated = { ...user }
  if (hydrated?.roles && typeof hydrated.roles === 'string') {
    try { hydrated.roles = JSON.parse(hydrated.roles) } catch (_error) { hydrated.roles = {} }
  }
  if (hydrated?.profile && typeof hydrated.profile === 'string') {
    try { hydrated.profile = JSON.parse(hydrated.profile) } catch (_error) { hydrated.profile = {} }
  }
  return hydrated
}

export async function sweepExpiredMemberships({ limit = 200 } = {}) {
  if (!neonHelper?.isConfigured) {
    return { success: true, scanned: 0, expired: 0, notified: 0, skipped: 0 }
  }

  await ensureMembershipNotificationLogTable()
  const eventKeySql = buildMembershipExpiredEventKeySql({
    userIdColumn: 'u.user_id',
    expireAtColumn: 'u.member_expire_at'
  })

  const rows = await neonHelper.query(
    `SELECT u.*
       FROM users u
       LEFT JOIN membership_notification_log log
         ON log.event_key = ${eventKeySql}
      WHERE u.member_status IN ('active', 'pro', 'lifetime', 'expired')
        AND u.member_expire_at IS NOT NULL
        AND u.member_expire_at <= NOW()
        AND log.event_key IS NULL
        AND NOT EXISTS (
          SELECT 1
            FROM notifications n
           WHERE n.user_id = u.user_id
             AND n.type = 'membership_expired'
             AND n.content LIKE '%' || TO_CHAR(u.member_expire_at AT TIME ZONE 'Asia/Shanghai', 'YYYY/MM/DD HH24:MI') || '%'
        )
      ORDER BY u.member_expire_at ASC
      LIMIT $1`,
    [Math.max(1, Number(limit) || 200)]
  )

  let expired = 0
  let notified = 0

  for (const rawRow of rows || []) {
    const user = hydrateUserRecord(rawRow)
    if (!user?.user_id) continue

    let updatedUser = user
    if (['active', 'pro', 'lifetime'].includes(String(user.member_status || '').toLowerCase())) {
      const updateResult = await neonHelper.query(
        `UPDATE users
            SET member_status = 'expired',
                updated_at = NOW()
          WHERE user_id = $1
            AND member_status IN ('active', 'pro', 'lifetime')
            AND member_expire_at IS NOT NULL
            AND member_expire_at <= NOW()
        RETURNING *`,
        [user.user_id]
      )

      updatedUser = hydrateUserRecord(updateResult?.[0] || null)
      if (!updatedUser) continue
    }

    expired += 1

    try {
      const didNotify = await notifyMembershipExpired(updatedUser)
      if (didNotify) notified += 1
    } catch (error) {
      console.error('[membership-lifecycle] Failed to notify expired member:', updatedUser.user_id, error)
    }
  }

  return {
    success: true,
    scanned: (rows || []).length,
    expired,
    notified,
    skipped: Math.max(0, (rows || []).length - expired)
  }
}
