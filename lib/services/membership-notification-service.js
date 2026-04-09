import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  sendMembershipActivatedEmail,
  sendMembershipExpiredEmail
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
    case 'quarter':
      return '季度会员'
    case 'year':
      return '年度会员'
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
  const title = '会员权益已失效'
  const content = [
    `Hi ${getDisplayName(user)}，您的${memberTypeLabel}已于 ${expireAt} 失效。`,
    '您的账号权益已退回免费用户版本，如需恢复会员权益，可前往会员中心重新开通。'
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
