/**
 * 更新用户资料 API
 * PATCH /api/auth/update-profile
 * 用于更新用户的个人信息（从简历自动提取或手动填写）
 */

import { verifyToken, extractToken, sanitizeUser } from '../utils/auth-helpers.js'
import { getUserById, saveUser } from '../utils/user-storage.js'

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only PATCH allowed
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // 提取 JWT token
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({
        success: false,
        error: '未提供认证令牌'
      })
    }

    // 验证 token
    const payload = verifyToken(token)
    if (!payload || !payload.userId) {
      return res.status(401).json({
        success: false,
        error: '认证令牌无效或已过期'
      })
    }

    // 获取用户信息
    const user = await getUserById(payload.userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }

    // 检查账户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: '账户已被停用'
      })
    }

    // 允许更新的字段
    const {
      username,
      fullName,
      title,
      location,
      targetRole,
      phone,
      bio
    } = req.body

    // 更新基本信息
    if (username !== undefined && typeof username === 'string' && username.trim().length > 0) {
      user.username = username.trim()
    }

    // 更新或创建 profile 对象
    if (!user.profile) {
      user.profile = {}
    }

    // 更新 profile 字段（只更新提供的字段）
    if (fullName !== undefined) {
      user.profile.fullName = typeof fullName === 'string' ? fullName.trim() : undefined
    }
    if (title !== undefined) {
      user.profile.title = typeof title === 'string' ? title.trim() : undefined
    }
    if (location !== undefined) {
      user.profile.location = typeof location === 'string' ? location.trim() : undefined
    }
    if (targetRole !== undefined) {
      user.profile.targetRole = typeof targetRole === 'string' ? targetRole.trim() : undefined
    }
    if (phone !== undefined) {
      user.profile.phone = typeof phone === 'string' ? phone.trim() : undefined
    }
    if (bio !== undefined) {
      user.profile.bio = typeof bio === 'string' ? bio.trim() : undefined
    }

    // 更新时间戳
    user.updatedAt = new Date().toISOString()

    // 保存用户
    const { success } = await saveUser(user)
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '更新失败，请稍后重试'
      })
    }

    console.log(`[update-profile] User profile updated: ${user.email}`)

    // 返回更新后的用户信息
    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
      message: '资料更新成功'
    })
  } catch (error) {
    console.error('[update-profile] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

