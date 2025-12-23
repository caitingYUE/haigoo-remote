/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（管理员）
 * GET /api/users?id=xxx - 获取特定用户详情
 */

import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
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

const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  const isAdmin = !!(requester?.roles?.admin || requester?.email === SUPER_ADMIN_EMAIL)
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status, username, roles, memberStatus, memberExpireAt } = req.body || {}
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      // 使用统一的updateUser函数
      const result = await userHelper.updateUser(id, { status, username, roles, memberStatus, memberExpireAt }, { isAdmin: true })
      
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error || '更新失败，请稍后重试' })
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
      if (target?.email === SUPER_ADMIN_EMAIL) {
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

