/**
 * 重新发送验证邮件 API
 * POST /api/auth/resend-verification
 */

import {
  generateVerificationToken,
  generateVerificationExpiry,
  isValidEmail
} from '../utils/auth-helpers.js'
import { getUserByEmail, saveUser } from '../utils/user-storage.js'
import { sendVerificationEmail, isEmailServiceConfigured } from '../utils/email-service.js'

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
    const { email } = req.body

    // 验证必填字段
    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱不能为空'
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
      // 为了安全，不暴露用户是否存在
      return res.status(200).json({
        success: true,
        message: '如果该邮箱已注册，验证邮件将发送到您的邮箱'
      })
    }

    // 检查是否已验证
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: '该邮箱已验证，无需重新发送'
      })
    }

    // 生成新的验证令牌
    user.verificationToken = generateVerificationToken()
    user.verificationExpires = generateVerificationExpiry()
    user.updatedAt = new Date().toISOString()

    const { success } = await saveUser(user)
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '发送失败，请稍后重试'
      })
    }

    // 发送验证邮件
    if (isEmailServiceConfigured()) {
      const emailSent = await sendVerificationEmail(email, user.username, user.verificationToken)
      if (!emailSent) {
        console.warn(`[resend-verification] Failed to send email to ${email}`)
      }
    } else {
      console.log(`[resend-verification] Email service not configured, token: ${user.verificationToken}`)
    }

    console.log(`[resend-verification] Verification email sent to: ${email}`)

    return res.status(200).json({
      success: true,
      message: isEmailServiceConfigured() 
        ? '验证邮件已发送，请查收' 
        : '验证邮件已发送（邮件服务未配置）'
    })
  } catch (error) {
    console.error('[resend-verification] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    })
  }
}

