/**
 * 获取当前用户信息 API
 * GET /api/auth/me
 * 用于验证 token 并返回用户信息
 */

import { verifyToken, extractToken, sanitizeUser } from '../utils/auth-helpers.js'
import { getUserById } from '../utils/user-storage.js'

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only GET allowed
  if (req.method !== 'GET') {
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

    console.log(`[auth/me] User info requested: ${user.email}`)

    // 返回用户信息（不含敏感数据）
    return res.status(200).json({
      success: true,
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

