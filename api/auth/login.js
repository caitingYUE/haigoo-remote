/**
 * 用户登录 API
 * POST /api/auth/login
 * 支持邮箱 + 密码登录
 */

import {
  generateToken,
  comparePassword,
  isValidEmail,
  sanitizeUser
} from '../utils/auth-helpers.js'
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
    const { email, password } = req.body

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '邮箱和密码不能为空'
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
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      })
    }

    // 检查是否为邮箱登录用户
    if (user.authProvider !== 'email') {
      return res.status(400).json({
        success: false,
        error: `该账户使用 ${user.authProvider} 登录，请使用对应方式登录`
      })
    }

    // 验证密码
    const passwordMatch = await comparePassword(password, user.passwordHash)
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      })
    }

    // 检查账户状态
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: '账户已被暂停，请联系管理员'
      })
    }
    if (user.status === 'deleted') {
      return res.status(403).json({
        success: false,
        error: '账户已被删除'
      })
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date().toISOString()
    user.updatedAt = new Date().toISOString()
    await saveUser(user)

    console.log(`[login] User logged in: ${email}`)

    // 生成 JWT token
    const token = generateToken({ userId: user.id, email: user.email })

    // 返回成功响应（不含敏感数据）
    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: '登录成功'
    })
  } catch (error) {
    console.error('[login] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

