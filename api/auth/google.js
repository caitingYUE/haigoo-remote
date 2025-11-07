/**
 * Google OAuth 登录 API
 * POST /api/auth/google
 * 处理 Google OAuth 的 ID Token 验证和用户创建/登录
 */

import { OAuth2Client } from 'google-auth-library'
import {
  generateToken,
  generateRandomAvatar,
  sanitizeUser
} from '../utils/auth-helpers.js'
import { getUserByEmail, saveUser } from '../utils/user-storage.js'
import crypto from 'crypto'

// Google OAuth Client ID（从环境变量读取）
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID

// 创建 Google OAuth2 客户端
const googleClient = GOOGLE_CONFIGURED ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * 验证 Google ID Token
 * @param {string} token - Google ID Token
 * @returns {Promise<Object|null>} 用户信息或 null
 */
async function verifyGoogleToken(token) {
  if (!GOOGLE_CONFIGURED || !googleClient) {
    console.error('[google-auth] Google OAuth not configured')
    return null
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload()
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified || false
    }
  } catch (error) {
    console.error('[google-auth] Token verification failed:', error.message)
    return null
  }
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
    // 检查 Google OAuth 是否配置
    if (!GOOGLE_CONFIGURED) {
      return res.status(501).json({
        success: false,
        error: 'Google OAuth 未配置，请联系管理员'
      })
    }

    const { idToken } = req.body

    // 验证必填字段
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Google ID Token 不能为空'
      })
    }

    // 验证 Google Token
    const googleUser = await verifyGoogleToken(idToken)
    if (!googleUser) {
      return res.status(401).json({
        success: false,
        error: 'Google 登录验证失败'
      })
    }

    console.log(`[google-auth] Google user authenticated: ${googleUser.email}`)

    // 检查用户是否已存在
    let user = await getUserByEmail(googleUser.email)

    if (user) {
      // 用户已存在，检查是否为 Google 登录
      if (user.authProvider !== 'google') {
        return res.status(400).json({
          success: false,
          error: `该邮箱已使用 ${user.authProvider} 方式注册，请使用对应方式登录`
        })
      }

      // 更新最后登录时间和 Google 信息
      user.lastLoginAt = new Date().toISOString()
      user.updatedAt = new Date().toISOString()
      // 更新头像（如果 Google 提供了新头像）
      if (googleUser.picture) {
        user.avatar = googleUser.picture
      }
      await saveUser(user)

      console.log(`[google-auth] Existing user logged in: ${googleUser.email}`)
    } else {
      // 创建新用户
      const userId = crypto.randomUUID()
      
      user = {
        id: userId,
        email: googleUser.email,
        username: googleUser.name || `User_${crypto.randomBytes(3).toString('hex')}`,
        avatar: googleUser.picture || generateRandomAvatar(userId, 'personas'),
        authProvider: 'google',
        googleId: googleUser.googleId,
        emailVerified: googleUser.emailVerified, // Google 已验证邮箱
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        status: 'active'
      }

      const { success, provider } = await saveUser(user)
      if (!success) {
        return res.status(500).json({
          success: false,
          error: '注册失败，请稍后重试'
        })
      }

      console.log(`[google-auth] New user registered: ${googleUser.email} (provider: ${provider})`)
    }

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
    console.error('[google-auth] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

