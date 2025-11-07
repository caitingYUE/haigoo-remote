/**
 * 邮箱验证 API
 * POST /api/auth/verify-email
 * 验证用户提供的邮箱验证令牌
 */

import { isValidEmail, isTokenExpired, sanitizeUser } from '../utils/auth-helpers.js'
import { getUserByEmail, saveUser } from '../utils/user-storage.js'

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { email, token } = req.body

    // 验证必填字段
    if (!email || !token) {
      return res.status(400).json({
        success: false,
        error: '邮箱和验证令牌不能为空'
      })
    }

    // 验证邮箱格式
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: '邮箱格式无效'
      })
    }

    // 获取用户
    const user = await getUserByEmail(email)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }

    // 检查是否已验证
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: '邮箱已验证，无需重复验证',
        user: sanitizeUser(user)
      })
    }

    // 检查验证令牌是否匹配
    if (user.verificationToken !== token) {
      return res.status(400).json({
        success: false,
        error: '验证令牌无效'
      })
    }

    // 检查令牌是否过期
    if (isTokenExpired(user.verificationExpires)) {
      return res.status(400).json({
        success: false,
        error: '验证令牌已过期，请重新发送验证邮件'
      })
    }

    // 更新用户状态
    user.emailVerified = true
    user.verificationToken = undefined // 清除令牌
    user.verificationExpires = undefined
    user.updatedAt = new Date().toISOString()

    const { success } = await saveUser(user)
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '验证失败，请稍后重试'
      })
    }

    console.log(`[verify-email] Email verified: ${email}`)

    return res.status(200).json({
      success: true,
      message: '邮箱验证成功！',
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('[verify-email] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

