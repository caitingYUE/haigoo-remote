/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（管理员）
 * GET /api/users?id=xxx - 获取特定用户详情
 * PATCH /api/users - 更新用户信息
 * DELETE /api/users?id=xxx - 删除用户
 */

import { extractToken, verifyToken } from '../server-utils/auth-helpers.js'
import neonHelper from '../server-utils/dal/neon-helper.js'

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
     * 从Neon/PostgreSQL获取所有用户
     */
    async function getAllUsersFromNeon() {
      try {
        // 使用JOIN查询一次性获取用户及其收藏信息
        const usersResult = await neonHelper.query(`
          SELECT 
            u.id, u.email, u.username, u.status, u.roles, u.createdAt, u.updatedAt,
            COALESCE(array_agg(f.jobId) FILTER (WHERE f.jobId IS NOT NULL), '{}') as favorites,
            COUNT(f.id) as favoritesCount
          FROM users u
          LEFT JOIN favorites f ON u.id = f.userId
          GROUP BY u.id
          ORDER BY u.createdAt DESC
        `)

        return usersResult || []
      } catch (error) {
        console.error('[users] Neon getAllUsers error:', error.message)
        return null
      }
    }

/**
     * 从Neon/PostgreSQL获取单个用户
     */
    async function getUserFromNeon(userId) {
      try {
        // 使用JOIN查询获取用户及其收藏信息
        const result = await neonHelper.query(`
          SELECT 
            u.user_id, u.email, u.username, u.status, u.roles, u.createdAt, u.updatedAt,
            COALESCE(array_agg(f.jobId) FILTER (WHERE f.jobId IS NOT NULL), '{}') as favorites,
            COUNT(f.id) as favoritesCount
          FROM users u
          LEFT JOIN favorites f ON u.user_id = f.user_id
          WHERE u.user_id = $1
          GROUP BY u.user_id
        `, [userId])

        return result?.[0] || null
      } catch (error) {
        console.error(`[users] Neon getUser error for ${userId}:`, error.message)
        return null
      }
    }

const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'

/**
 * 清理用户敏感信息
 */
function sanitizeUser(user) {
  if (!user) return null
  const { passwordHash, verificationToken, ...safeUser } = user
  return safeUser
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 检查Neon/PostgreSQL是否配置
  if (!neonHelper.isConfigured) {
    return res.status(500).json({
      success: false,
      error: 'Neon/PostgreSQL not configured'
    })
  }

  // 验证管理员身份
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null

  // 获取请求者信息
  let requester = null
  if (payload?.userId) {
    const result = await neonHelper.query(`
      SELECT user_id, email, roles 
      FROM users 
      WHERE user_id = $1
    `, [payload.userId])
    requester = result?.[0]
  }
  console.log('[users] payload:', payload)
  console.log('[users] requester:', requester)

  const isAdmin = !!(requester?.roles?.admin || requester?.email === SUPER_ADMIN_EMAIL)
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  // 处理PATCH请求 - 更新用户信息
  if (req.method === 'PATCH') {
    try {
      const { id, status, username, roles } = req.body || {}
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      // 查找用户
      const userResult = await neonHelper.select('users', { id })
      const user = userResult?.[0]

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      // 更新用户信息
      const updateFields = { updatedAt: new Date().toISOString() }

      if (status && ['active', 'suspended'].includes(status)) {
        updateFields.status = status
      }

      if (typeof username === 'string' && username.trim()) {
        updateFields.username = username.trim()
      }

      if (roles && typeof roles === 'object') {
        // 超级管理员不可更改权限
        if (user.email === SUPER_ADMIN_EMAIL) {
          updateFields.roles = { ...(user.roles || {}), admin: true }
        } else {
          updateFields.roles = { ...(user.roles || {}), ...roles }
        }
      }

      // 执行更新
      const result = await neonHelper.update('users', updateFields, { id })

      if (!result || result.matchedCount === 0) {
        return res.status(500).json({ success: false, error: '更新失败，请稍后重试' })
      }

      // 获取更新后的用户信息
      const updatedUserResult = await neonHelper.query(`
        SELECT user_id, email, username, status, roles, createdAt, updatedAt 
        FROM users 
        WHERE user_id = $1
      `, [id])
      const updatedUser = updatedUserResult?.[0]

      return res.status(200).json({
        success: true,
        user: updatedUser
      })
    } catch (error) {
      console.error('[users] PATCH error:', error)
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  // 处理DELETE请求 - 删除用户
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      // 查找用户
      const targetResult = await neonHelper.select('users', { id })
      const target = targetResult?.[0]

      // 超级管理员不可删除
      if (target?.email === SUPER_ADMIN_EMAIL) {
        return res.status(400).json({ success: false, error: '不可删除超级管理员' })
      }

      // 删除用户
      const userResult = await neonHelper.delete('users', { id })

      // 如果用户被删除，同时删除其收藏记录
      if (userResult && userResult.rows?.length > 0) {
        await neonHelper.delete('favorites', { userId: id })
      }

      return res.status(200).json({
        success: result && result.deletedCount > 0,
        deletedCount: result ? result.deletedCount : 0
      })
    } catch (e) {
      console.error('[users] DELETE error:', e)
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  // 处理GET请求 - 获取用户信息
  if (req.method === 'GET') {
    try {
      const { id } = req.query
      const provider = 'neon'

      // 如果提供了id，返回特定用户
      if (id) {
        const user = await getUserFromNeon(id)

        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' })
        }

        return res.status(200).json({
          success: true,
          user: sanitizeUser(user),
          provider
        })
      }

      // 获取所有用户列表
      const users = await getAllUsersFromNeon()

      if (!users) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users'
        })
      }

      // 按创建时间倒序排列（最新的在前）
      const sortedUsers = [...users].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )

      console.log(`[users] Fetched ${sortedUsers.length} users from ${provider}`)

      return res.status(200).json({
        success: true,
        users: sortedUsers,
        total: sortedUsers.length,
        provider
      })
    } catch (error) {
      console.error('[users] Error:', error)
      return res.status(500).json({
        success: false,
        error: '服务器错误'
      })
    }
  }

  // 不支持的HTTP方法
  return res.status(405).json({ success: false, error: 'Method not allowed' })

}
