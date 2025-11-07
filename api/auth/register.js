/**
 * 用户注册 API
 * POST /api/auth/register
 * 支持邮箱 + 密码注册
 */

import {
  generateToken,
  hashPassword,
  generateRandomUsername,
  generateRandomAvatar,
  generateVerificationToken,
  generateVerificationExpiry,
  isValidEmail,
  isValidPassword,
  sanitizeUser
} from '../utils/auth-helpers.js'
import { saveUser, isEmailTaken } from '../utils/user-storage.js'
import { sendVerificationEmail, isEmailServiceConfigured } from '../utils/email-service.js'
import crypto from 'crypto'

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
    const { email, password, username } = req.body

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

    // 验证密码强度
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: '密码至少8位，且包含字母和数字'
      })
    }

    // 检查邮箱是否已被注册
    const emailExists = await isEmailTaken(email)
    if (emailExists) {
      return res.status(409).json({
        success: false,
        error: '该邮箱已被注册'
      })
    }

    // 生成用户ID
    const userId = crypto.randomUUID()

    // 生成用户名（如果未提供）
    const finalUsername = username || generateRandomUsername()

    // 生成随机头像
    const avatar = generateRandomAvatar(userId, 'personas')

    // 加密密码
    const passwordHash = await hashPassword(password)

    // 生成邮箱验证令牌
    const verificationToken = generateVerificationToken()
    const verificationExpires = generateVerificationExpiry()

    // 创建用户对象
    const user = {
      id: userId,
      email,
      username: finalUsername,
      avatar,
      authProvider: 'email',
      passwordHash,
      emailVerified: false, // 默认未验证
      verificationToken,
      verificationExpires,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    }

    // 保存用户
    const { success, provider } = await saveUser(user)
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '注册失败，请稍后重试'
      })
    }

    console.log(`[register] New user registered: ${email} (provider: ${provider})`)

    // 发送验证邮件
    if (isEmailServiceConfigured()) {
      const emailSent = await sendVerificationEmail(email, finalUsername, verificationToken)
      if (!emailSent) {
        console.warn(`[register] Failed to send verification email to ${email}`)
      }
    } else {
      console.log(`[register] Email service not configured, verification token: ${verificationToken}`)
    }

    // 生成 JWT token
    const token = generateToken({ userId, email })

    // 返回成功响应（不含敏感数据）
    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: isEmailServiceConfigured() 
        ? '注册成功！请查收验证邮件' 
        : '注册成功！（邮件服务未配置）'
    })
  } catch (error) {
    console.error('[register] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

