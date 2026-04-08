import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  sendMembershipActivatedEmail,
  sendMembershipExpiredEmail
} from '../../server-utils/email-service.js'
import { normalizeMemberType } from '../shared/membership.js'

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

  const memberTypeLabel = getMembershipTypeLabel(
    user.memberType || user.member_type || user.membershipLevel || user.membership_level
  )
  const expireAt = formatDateTimeLabel(user.memberExpireAt || user.member_expire_at)
  const title = '会员权益已失效'
  const content = [
    `Hi ${getDisplayName(user)}，您的${memberTypeLabel}已于 ${expireAt} 失效。`,
    '您的账号原有免费体验额度不会重置，仍按原免费权益基线继续生效。',
    '如需恢复会员权益，可前往会员中心重新开通。'
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
