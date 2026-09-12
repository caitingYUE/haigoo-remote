import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  sendMembershipActivatedEmail,
  sendMembershipExpiredEmail,
  sendMembershipRefundedEmail
} from '../../server-utils/email-service.js'
import { normalizeMemberType } from '../shared/membership.js'

const MEMBERSHIP_NOTIFICATION_LOG_READY = '__haigoo_membership_notification_log_ready'

function getDisplayName(user) {
  return user?.username || user?.profile?.fullName || user?.fullName || '你好'
}

function getMembershipTypeLabel(memberType) {
	  switch (normalizeMemberType(memberType)) {
    case 'trial_week':
      return '体验会员'
    case 'starter':
      return '月度会员'
    case 'quarter':
      return 'Club 会员'
    case 'quarter_pro':
      return 'Club 会员'
    case 'year':
      return '年度会员'
    case 'half_year':
      return 'Club Member'
    case 'annual':
      return 'Club Partner'
	    default:
	      return '会员'
	  }
}

function formatDateTimeLabel(value) {
  if (!value) return '待确认'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getEventTimestampToken(value) {
  const date = new Date(value)
  const timestamp = date.getTime()
  return Number.isFinite(timestamp) ? String(timestamp) : 'na'
}

export function buildMembershipExpiredEventKey(user) {
  return `membership_expired:${user?.user_id || ''}:${getEventTimestampToken(user?.memberExpireAt || user?.member_expire_at)}`
}

export function buildMembershipExpiredEventKeySql({
  userIdColumn = 'user_id',
  expireAtColumn = 'member_expire_at'
} = {}) {
  return `'membership_expired:' || ${userIdColumn} || ':' || CAST(FLOOR(EXTRACT(EPOCH FROM ${expireAtColumn}) * 1000) AS BIGINT)`
}

export async function ensureMembershipNotificationLogTable() {
  if (!neonHelper?.isConfigured) return

  if (!globalThis[MEMBERSHIP_NOTIFICATION_LOG_READY]) {
    globalThis[MEMBERSHIP_NOTIFICATION_LOG_READY] = (async () => {
      await neonHelper.query(`
        CREATE TABLE IF NOT EXISTS membership_notification_log (
          event_key VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          event_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await neonHelper.query(`
        CREATE INDEX IF NOT EXISTS idx_membership_notification_log_user_event
        ON membership_notification_log(user_id, event_type, created_at DESC)
      `)
    })().catch((error) => {
      globalThis[MEMBERSHIP_NOTIFICATION_LOG_READY] = null
      throw error
    })
  }

  return globalThis[MEMBERSHIP_NOTIFICATION_LOG_READY]
}

async function insertNotificationOnce({ userId, type, title, content }) {
  if (!neonHelper?.isConfigured || !userId) return false

  const existing = await neonHelper.query(
    `SELECT id
       FROM notifications
      WHERE user_id = $1
        AND type = $2
        AND title = $3
        AND content = $4
      LIMIT 1`,
    [userId, type, title, content]
  )

  if (existing?.[0]?.id) return false

  await neonHelper.query(
    `INSERT INTO notifications (user_id, type, title, content, is_read, created_at)
     VALUES ($1, $2, $3, $4, false, NOW())`,
    [userId, type, title, content]
  )

  return true
}

async function recordMembershipEvent({ eventKey, userId, eventType, eventAt }) {
  if (!neonHelper?.isConfigured || !eventKey || !userId || !eventType) return false
  await ensureMembershipNotificationLogTable()

  const rows = await neonHelper.query(
    `INSERT INTO membership_notification_log (event_key, user_id, event_type, event_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING event_key`,
    [eventKey, userId, eventType, eventAt || null]
  )

  return Boolean(rows?.[0]?.event_key)
}

async function hasExistingExpiredNotification(user) {
  if (!neonHelper?.isConfigured || !user?.user_id) return false

  const expireAt = formatDateTimeLabel(user.memberExpireAt || user.member_expire_at)
  const rows = await neonHelper.query(
    `SELECT id
       FROM notifications
      WHERE user_id = $1
        AND type = 'membership_expired'
        AND content LIKE $2
      LIMIT 1`,
    [user.user_id, `%${expireAt}%`]
  )

  return Boolean(rows?.[0]?.id)
}

export async function notifyMembershipActivated(user) {
  if (!user?.user_id) return false

  // A paid renewal was already confirmed at checkout; crossing an internal
  // order boundary must not send another "membership started" email.
  if (neonHelper?.isConfigured) {
    const paid = await neonHelper.query(
      `SELECT p.payment_id FROM membership_entitlement_segments s
       JOIN payment_records p ON p.payment_id = s.source_payment_id
       WHERE s.user_id = $1 AND s.starts_at = $2::timestamptz
         AND s.superseded_at IS NULL AND p.provider = 'wechat_virtual'
         AND p.metadata #>> '{membershipPurchaseEmail,sentAt}' IS NOT NULL LIMIT 1`,
      [user.user_id, user.memberCycleStartAt || user.member_cycle_start_at || null]
    )
    if (paid?.length) return false
  }

  const memberTypeLabel = getMembershipTypeLabel(
    user.memberType || user.member_type || user.membershipLevel || user.membership_level
  )
  const startAt = formatDateTimeLabel(
    user.memberCycleStartAt || user.member_cycle_start_at || user.memberSince || user.member_since
  )
  const expireAt = formatDateTimeLabel(user.memberExpireAt || user.member_expire_at)
  const title = '会员已生效'
  const content = [
    `Hi ${getDisplayName(user)}，您的${memberTypeLabel}已开通成功。`,
    `生效时间：${startAt}`,
    `失效时间：${expireAt}`
  ].join('\n')

  const inserted = await insertNotificationOnce({
    userId: user.user_id,
    type: 'membership_activated',
    title,
    content
  })

  if (!inserted || !user.email) return inserted

  await sendMembershipActivatedEmail({
    to: user.email,
    username: getDisplayName(user),
    accountEmail: user.email,
    memberType: user.memberType || user.member_type,
    memberStartAt: user.memberCycleStartAt || user.member_cycle_start_at || user.memberSince || user.member_since,
    memberExpireAt: user.memberExpireAt || user.member_expire_at
  })

  return true
}

export async function notifyWechatMembershipPurchased(paymentId) {
  const rows = await neonHelper.query(
    `SELECT p.metadata->'membershipPurchaseEmail' AS receipt, u.email, u.username,
            u.member_cycle_start_at, u.member_type AS current_member_type, s.member_type, s.starts_at, s.ends_at
       FROM payment_records p JOIN users u ON u.user_id = p.user_id
       JOIN membership_entitlement_segments s ON s.source_payment_id = p.payment_id
      WHERE p.payment_id = $1 AND p.provider = 'wechat_virtual'
        AND p.status = 'completed' AND s.superseded_at IS NULL`,
    [paymentId]
  )
  const row = rows?.[0]
  if (!row || row.receipt?.sentAt || !row.email) return false
  const receipt = {
    to: row.email, username: row.username, memberType: row.member_type,
    memberStartAt: row.starts_at, memberExpireAt: row.ends_at,
    isRenewal: ['starter', 'quarter'].includes(row.member_type) && row.current_member_type === row.member_type
      && new Date(row.starts_at).getTime() > new Date(row.member_cycle_start_at).getTime()
  }
  // Persist the exact receipt before sending so retries use an identical payload.
  const saved = await neonHelper.query(
    `UPDATE payment_records SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
       '{membershipPurchaseEmail}', COALESCE(metadata->'membershipPurchaseEmail', $2::jsonb))
     WHERE payment_id = $1 RETURNING metadata->'membershipPurchaseEmail' AS receipt`,
    [paymentId, JSON.stringify(receipt)]
  )
  const snapshot = saved?.[0]?.receipt
  if (!snapshot || snapshot.sentAt) return false
  const sent = await sendMembershipActivatedEmail({ ...snapshot, purchaseSucceeded: true, idempotencyKey: `membership-purchase/${paymentId}` })
  if (!sent) throw new Error('会员购买成功邮件发送失败，等待支付通知重试')
  await neonHelper.query(
    `UPDATE payment_records SET metadata = jsonb_set(metadata,
       '{membershipPurchaseEmail,sentAt}', to_jsonb(NOW())) WHERE payment_id = $1`,
    [paymentId]
  )
  return true
}

export async function notifyWechatMembershipRefunded(paymentId) {
  const rows = await neonHelper.query(
    `SELECT p.metadata->'membershipRefundEmail' AS receipt,
            p.status AS payment_status, p.refund_status, p.refunded_amount_cents, p.refunded_at,
            u.email, u.username,
            COALESCE(segment.member_type, p.metadata #>> '{virtualPayment,planSnapshot,memberType}') AS refunded_member_type,
            (u.member_status IN ('active', 'pro')
              AND (u.member_expire_at IS NULL OR u.member_expire_at > NOW())) AS membership_active,
            GREATEST(
              u.member_expire_at AT TIME ZONE 'UTC',
              (SELECT MAX(active_segment.ends_at)
                 FROM membership_entitlement_segments active_segment
                WHERE active_segment.user_id = u.user_id
                  AND active_segment.superseded_at IS NULL)
            ) AS member_expire_at
       FROM payment_records p
       JOIN users u ON u.user_id = p.user_id
       LEFT JOIN LATERAL (
         SELECT member_type FROM membership_entitlement_segments
          WHERE source_payment_id = p.payment_id
          ORDER BY created_at DESC LIMIT 1
       ) segment ON TRUE
      WHERE p.payment_id = $1 AND p.provider = 'wechat_virtual'
      LIMIT 1`,
    [paymentId]
  )
  const row = rows?.[0]
  if (
    !row || row.receipt?.sentAt || !row.email || row.payment_status !== 'refunded' ||
    String(row.refund_status || '').toUpperCase() !== 'COMPLETED' ||
    Number(row.refunded_amount_cents || 0) <= 0
  ) return false

  const receipt = {
    to: row.email,
    username: row.username,
    accountEmail: row.email,
    memberType: row.refunded_member_type,
    paymentId,
    refundAmountCents: Number(row.refunded_amount_cents),
    refundedAt: row.refunded_at,
    membershipActive: Boolean(row.membership_active),
    memberExpireAt: row.member_expire_at
  }
  const saved = await neonHelper.query(
    `UPDATE payment_records SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
       '{membershipRefundEmail}', COALESCE(metadata->'membershipRefundEmail', $2::jsonb))
     WHERE payment_id = $1 RETURNING metadata->'membershipRefundEmail' AS receipt`,
    [paymentId, JSON.stringify(receipt)]
  )
  const snapshot = saved?.[0]?.receipt
  if (!snapshot || snapshot.sentAt) return false
  const sent = await sendMembershipRefundedEmail({
    ...snapshot,
    idempotencyKey: `membership-refund/${paymentId}`
  })
  if (!sent) throw new Error('会员退款邮件发送失败，等待退款通知或会员状态刷新重试')
  await neonHelper.query(
    `UPDATE payment_records SET metadata = jsonb_set(metadata,
       '{membershipRefundEmail,sentAt}', to_jsonb(NOW())) WHERE payment_id = $1`,
    [paymentId]
  )
  return true
}

export async function notifyMembershipExpired(user) {
  if (!user?.user_id) return false

  const eventKey = buildMembershipExpiredEventKey(user)
  const eventAt = user.memberExpireAt || user.member_expire_at || null
  if (await hasExistingExpiredNotification(user)) {
    await recordMembershipEvent({
      eventKey,
      userId: user.user_id,
      eventType: 'membership_expired',
      eventAt
    })
    return false
  }

  const claimed = await recordMembershipEvent({
    eventKey,
    userId: user.user_id,
    eventType: 'membership_expired',
    eventAt
  })
  if (!claimed) return false

  const memberTypeLabel = getMembershipTypeLabel(
    user.memberType || user.member_type || user.membershipLevel || user.membership_level
  )
  const expireAt = formatDateTimeLabel(user.memberExpireAt || user.member_expire_at)
  const title = '本期会员服务已到期'
  const content = [
    `Hi ${getDisplayName(user)}，你的${memberTypeLabel}已于 ${expireAt} 到期。`,
    '公开岗位和免费功能仍可继续使用。如有新的求职安排，可在个人中心联系顾问。'
  ].join('\n')

  const inserted = await insertNotificationOnce({
    userId: user.user_id,
    type: 'membership_expired',
    title,
    content
  })

  if (!inserted || !user.email) return inserted

  await sendMembershipExpiredEmail({
    to: user.email,
    username: getDisplayName(user),
    accountEmail: user.email,
    memberType: user.memberType || user.member_type,
    memberExpireAt: user.memberExpireAt || user.member_expire_at
  })

  return true
}
