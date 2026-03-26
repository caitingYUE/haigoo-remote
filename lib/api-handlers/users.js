/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（管理员）
 * GET /api/users?id=xxx - 获取特定用户详情
 */

import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import { sendMembershipActivatedEmail } from '../../server-utils/email-service.js'
import { isMembershipActive, normalizeMemberType } from '../shared/membership.js'

// CORS headers
function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://haigoo-admin.vercel.app',
    'https://www.haigooremote.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * 清理用户敏感信息
 */
function sanitizeUser(user) {
  if (!user) return null
  const { passwordHash, verificationToken, ...safeUser } = user
  return safeUser
}

function shouldSendMembershipActivationEmail(previousUser, updatedUser) {
  if (!previousUser || !updatedUser?.email) return false

  const wasActive = isMembershipActive(previousUser)
  const isActive = isMembershipActive(updatedUser)
  if (!isActive) return false

  const previousType = normalizeMemberType(previousUser.memberType || previousUser.member_type, previousUser.membershipLevel || previousUser.membership_level)
  const nextType = normalizeMemberType(updatedUser.memberType || updatedUser.member_type, updatedUser.membershipLevel || updatedUser.membership_level)

  if (!wasActive) return nextType !== 'none'

  return (
    previousType !== nextType ||
    (previousUser.memberExpireAt || previousUser.member_expire_at || null) !== (updatedUser.memberExpireAt || updatedUser.member_expire_at || null) ||
    (previousUser.memberCycleStartAt || previousUser.member_cycle_start_at || null) !== (updatedUser.memberCycleStartAt || updatedUser.member_cycle_start_at || null)
  )
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res, req)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  const isAdmin = !!(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(requester?.email))
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method === 'PATCH') {
    try {
      const {
        id,
        status,
        username,
        roles,
        memberStatus,
        memberExpireAt,
        memberType,
        memberCycleStartAt,
        autoApplyMemberDuration
      } = req.body || {}
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      const previousUser = await userHelper.getUserById(id)
      if (!previousUser) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 使用统一的updateUser函数
      const result = await userHelper.updateUser(
        id,
        { status, username, roles, memberStatus, memberExpireAt, memberType, memberCycleStartAt, autoApplyMemberDuration },
        { isAdmin: true }
      )

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error || '更新失败，请稍后重试' })
      }

      if (shouldSendMembershipActivationEmail(previousUser, result.user)) {
        await sendMembershipActivatedEmail({
          to: result.user.email,
          username: result.user.username || result.user.profile?.fullName || result.user.fullName || '你好',
          accountEmail: result.user.email,
          memberType: result.user.memberType || result.user.member_type,
          memberStartAt: result.user.memberCycleStartAt || result.user.member_cycle_start_at || result.user.memberSince || result.user.member_since,
          memberExpireAt: result.user.memberExpireAt || result.user.member_expire_at
        })
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(result.user),
        message: result.message
      })
    } catch (error) {
      console.error('[users] PATCH error:', error)
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      const target = await userHelper.getUserById(String(id))
      if (SUPER_ADMIN_EMAILS.includes(target?.email)) {
        return res.status(400).json({ success: false, error: '不可删除超级管理员' })
      }

      const ok = await userHelper.deleteUserById(String(id))
      return res.status(ok ? 200 : 500).json({ success: !!ok })
    } catch (e) {
      console.error('[users] DELETE error:', e)
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    // 如果提供了 id，返回特定用户
    if (id) {
      const user = await userHelper.getUserById(id)
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(user),
        provider: 'neon'
      })
    }

    // 获取所有用户列表
    const users = await userHelper.getAllUsers()

    if (!users) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch users'
      })
    }

    // 清理敏感信息
    const safeUsers = users.map(sanitizeUser)

    console.log(`[users] Fetched ${safeUsers.length} users from neon`)

    return res.status(200).json({
      success: true,
      users: safeUsers,
      total: safeUsers.length,
      provider: 'neon'
    })
  } catch (error) {
    console.error('[users] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误'
    })
  }
}
