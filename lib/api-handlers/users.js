/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（管理员）
 * GET /api/users?id=xxx - 获取特定用户详情
 */

import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import { isMembershipActive, normalizeMemberType } from '../shared/membership.js'
import { notifyMembershipActivated } from '../services/membership-notification-service.js'

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
  const {
    passwordHash,
    password_hash,
    verificationToken,
    verification_token,
    verificationExpires,
    verification_expires,
    googleId,
    google_id,
    ...safeUser
  } = user
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

function isLocalDevRuntime() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'
}

function isLocalTestSuperAdminEmail(email) {
  return isLocalDevRuntime() && String(email || '').trim().toLowerCase() === 'test_admin@haigoo.com'
}

function normalizedEntitlementToLegacy(row) {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return {
    status: row.status,
    appointmentAt: metadata.appointmentAt || '',
    completedAt: metadata.completedAt || '',
    expiredAt: row.expires_at || '',
    note: row.notes || '',
    updatedAt: row.updated_at || ''
  }
}

async function hydrateNormalizedServiceEntitlements(users) {
  const source = Array.isArray(users) ? users : [users]
  const ids = source.map(user => user?.user_id || user?.userId).filter(Boolean)
  if (!neonHelper.isConfigured || ids.length === 0) return Array.isArray(users) ? source : source[0]
  try {
    const rows = await neonHelper.query(
      `SELECT user_id, entitlement_key, status, expires_at, metadata, notes, updated_at
         FROM user_member_service_entitlements
        WHERE user_id = ANY($1)`,
      [ids]
    )
    const byUser = new Map()
    for (const row of rows || []) {
      const key = String(row.user_id)
      if (!byUser.has(key)) byUser.set(key, {})
      byUser.get(key)[row.entitlement_key] = normalizedEntitlementToLegacy(row)
    }
    const hydrated = source.map(user => {
      const id = String(user?.user_id || user?.userId || '')
      const normalized = byUser.get(id)
      if (!normalized || Object.keys(normalized).length === 0) return user
      return { ...user, profile: { ...(user.profile || {}), memberServiceEntitlements: normalized } }
    })
    return Array.isArray(users) ? hydrated : hydrated[0]
  } catch (error) {
    console.warn('[users] Normalized service entitlement read unavailable, using legacy profile JSON:', error.message)
    return Array.isArray(users) ? source : source[0]
  }
}

async function syncNormalizedServiceEntitlements(userId, serviceEntitlements, adminUserId) {
  if (!neonHelper.isConfigured || !serviceEntitlements || typeof serviceEntitlements !== 'object') return
  for (const [key, record] of Object.entries(serviceEntitlements)) {
    const value = record && typeof record === 'object' ? record : {}
    const beforeRows = await neonHelper.query(
      `SELECT status, total_quota, used_quota, remaining_quota, expires_at, metadata, notes
         FROM user_member_service_entitlements WHERE user_id=$1 AND entitlement_key=$2 LIMIT 1`,
      [userId, key]
    )
    await neonHelper.query(
      `INSERT INTO user_member_service_entitlements
        (user_id, entitlement_key, status, total_quota, used_quota, remaining_quota, expires_at, metadata, notes, created_by, updated_by)
       SELECT $1, d.entitlement_key, $2, d.default_total_quota,
              CASE WHEN $2 IN ('completed','used','attended','published') THEN 1 ELSE 0 END,
              CASE WHEN d.default_total_quota IS NULL THEN NULL
                   WHEN $2 IN ('completed','used','attended','published') THEN GREATEST(d.default_total_quota - 1, 0)
                   ELSE d.default_total_quota END,
              $3, $4::jsonb, $5, $6, $6
         FROM member_service_entitlement_definitions d WHERE d.entitlement_key = $7
       ON CONFLICT (user_id, entitlement_key) DO UPDATE SET
         status=EXCLUDED.status, expires_at=EXCLUDED.expires_at, metadata=EXCLUDED.metadata,
         notes=EXCLUDED.notes, used_quota=EXCLUDED.used_quota, remaining_quota=EXCLUDED.remaining_quota,
         updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
      [userId, value.status || 'available', value.expiredAt || null, JSON.stringify({
        appointmentAt: value.appointmentAt || null,
        completedAt: value.completedAt || null,
        legacyUpdatedAt: value.updatedAt || new Date().toISOString()
      }), value.note || '', adminUserId, key]
    )
    await neonHelper.query(
      `INSERT INTO user_member_service_entitlement_audit
        (user_id, entitlement_key, admin_user_id, before_snapshot, after_snapshot, reason)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,'admin_user_management')`,
      [userId, key, adminUserId, JSON.stringify(beforeRows?.[0] || null), JSON.stringify({
        status: value.status || 'available', appointmentAt: value.appointmentAt || null,
        completedAt: value.completedAt || null, expiredAt: value.expiredAt || null, note: value.note || ''
      })]
    )
  }
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
  const requesterEmail = String(requester?.email || '').toLowerCase()
  const isSuperAdmin = !!(requester?.roles?.super_admin || SUPER_ADMIN_EMAILS.includes(requesterEmail) || isLocalTestSuperAdminEmail(requesterEmail))
  const isAdmin = !!(requester?.roles?.admin || isSuperAdmin)
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method === 'PATCH') {
    try {
      const action = req.body?.action
      if (action === 'update_entitlement_limit') {
        const {
          id,
          entitlementKey,
          delta,
          reason
        } = req.body || {}

        if (!isSuperAdmin) {
          return res.status(403).json({ success: false, error: '仅超级管理员可调整用户权益次数' })
        }

        if (!id) {
          return res.status(400).json({ success: false, error: '缺少用户ID' })
        }

        const result = await userHelper.updateUserEntitlementLimit(id, {
          entitlementKey,
          delta,
          adminUserId: requester.user_id || requester.userId,
          reason
        })

        if (!result.success) {
          return res.status(400).json({ success: false, error: result.error || '更新失败，请稍后重试' })
        }

        return res.status(200).json({
          success: true,
          user: sanitizeUser(result.user),
          entitlement: result.entitlement
        })
      }

      const {
        id,
        status,
        username,
        roles,
        memberStatus,
        memberExpireAt,
        memberType,
        memberCycleStartAt,
        autoApplyMemberDuration,
        serviceEntitlements
      } = req.body || {}
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      const previousUser = await userHelper.getUserById(id)
      if (!previousUser) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      if (serviceEntitlements !== undefined) {
        if (!isSuperAdmin) {
          return res.status(403).json({ success: false, error: '仅超级管理员可调整会员服务权益' })
        }
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

      if (serviceEntitlements !== undefined) {
        try {
          await syncNormalizedServiceEntitlements(id, serviceEntitlements, requester.user_id || requester.userId)
        } catch (entitlementError) {
          console.error('[users] Failed to sync normalized service entitlements:', entitlementError)
          return res.status(500).json({ success: false, error: '会员资料已更新，但服务权益台账同步失败，请重试' })
        }
      }

      if (shouldSendMembershipActivationEmail(previousUser, result.user)) {
        try {
          await notifyMembershipActivated(result.user)
        } catch (notificationError) {
          console.error('[users] Failed to send membership activation touchpoint:', notificationError)
        }
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(await hydrateNormalizedServiceEntitlements(result.user)),
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
      if (SUPER_ADMIN_EMAILS.includes(String(target?.email || '').toLowerCase())) {
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
    const { id, mode } = req.query

    // 如果提供了 id，返回特定用户
    if (id) {
      const user = await userHelper.getUserById(id)
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(await hydrateNormalizedServiceEntitlements(user)),
        provider: 'neon'
      })
    }

    if (mode === 'list') {
      const result = await userHelper.listUsersForAdmin({
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        status: req.query.status,
        provider: req.query.provider,
        source: req.query.source,
        memberStatus: req.query.memberStatus,
        exportMode: req.query.export === 'true'
      })

      if (!result) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users'
        })
      }

      return res.status(200).json({
        success: true,
        users: (await hydrateNormalizedServiceEntitlements(result.users)).map(sanitizeUser),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        stats: result.stats,
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
    const safeUsers = (await hydrateNormalizedServiceEntitlements(users)).map(sanitizeUser)

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
