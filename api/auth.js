/**
 * 统一的用户认证 API 处理器
 * 合并所有认证相关的端点到单个 Serverless Function
 * 路由：/api/auth?action={register|login|google|me|update-profile|verify-email|resend-verification}
 */

import {
  generateToken,
  verifyToken,
  extractToken,
  hashPassword,
  comparePassword,
  generateRandomUsername,
  generateRandomAvatar,
  generateVerificationToken,
  generateVerificationExpiry,
  isValidEmail,
  isValidPassword,
  sanitizeUser,
  isTokenExpired
} from '../server-utils/auth-helpers.js'
import { getUserByEmail, getUserById, saveUser } from '../server-utils/user-storage.js'
import { sendVerificationEmail, isEmailServiceConfigured } from '../server-utils/email-service.js'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'crypto'
import { kv } from '../server-utils/kv-client.js'
import { createClient } from 'redis'

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CONFIGURED ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// optional Redis client for Hobby plan without KV
const REDIS_URL = process.env.REDIS_URL
let redisClient = null
async function getRedis() {
  if (redisClient) return redisClient
  if (!REDIS_URL) return null
  redisClient = createClient({ url: REDIS_URL })
  await redisClient.connect()
  return redisClient
}

/**
 * 验证 Google ID Token
 */
async function verifyGoogleToken(token) {
  if (!GOOGLE_CONFIGURED || !googleClient) {
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
    console.error('[auth] Google token verification failed:', error.message)
    return null
  }
}

/**
 * 用户注册
 */
async function handleRegister(req, res) {
  const { email, password, username } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: '邮箱和密码不能为空' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式无效' })
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ success: false, error: '密码至少8位，且包含字母和数字' })
  }

  const emailExists = await getUserByEmail(email)
  if (emailExists) {
    return res.status(409).json({ success: false, error: '该邮箱已被注册' })
  }

  const userId = crypto.randomUUID()
  const finalUsername = username || generateRandomUsername()
  const avatar = generateRandomAvatar(userId, 'personas')
  const passwordHash = await hashPassword(password)
  const verificationToken = generateVerificationToken()
  const verificationExpires = generateVerificationExpiry()

  const user = {
    id: userId,
    email,
    username: finalUsername,
    avatar,
    authProvider: 'email',
    passwordHash,
    emailVerified: false,
    verificationToken,
    verificationExpires,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    roles: {
      admin: email === 'caitlinyct@gmail.com' || email === 'test@example.com'
    }
  }

  const { success } = await saveUser(user)
  if (!success) {
    return res.status(500).json({ success: false, error: '注册失败，请稍后重试' })
  }

  console.log(`[auth] New user registered: ${email}`)

  if (isEmailServiceConfigured()) {
    await sendVerificationEmail(email, finalUsername, verificationToken)
  }

  const token = generateToken({ userId, email })
  return res.status(201).json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: isEmailServiceConfigured() ? '注册成功！请查收验证邮件' : '注册成功！'
  })
}

/**
 * 用户登录
 */
async function handleLogin(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: '邮箱和密码不能为空' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式无效' })
  }

  const user = await getUserByEmail(email)
  if (!user) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
  }

  // 验证密码
  const passwordMatch = await comparePassword(password, user.passwordHash)
  if (!passwordMatch) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
  }

  // Force admin role for test user (Temporary fix for local dev)
  if (email === 'test@example.com') {
    console.log('[Auth] Force updating admin role for test user')
    if (!user.roles || !user.roles.admin) {
      user.roles = { ...user.roles, admin: true }
      await saveUser(user)
      console.log('[Auth] Admin role updated and saved')
    }
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: '账户已被停用' })
  }

  user.lastLoginAt = new Date().toISOString()
  user.updatedAt = new Date().toISOString()
  await saveUser(user)

  console.log(`[auth] User logged in: ${email}`)

  const token = generateToken({ userId: user.id, email: user.email })
  return res.status(200).json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: '登录成功'
  })
}

/**
 * Google OAuth 登录
 */
async function handleGoogleLogin(req, res) {
  if (!GOOGLE_CONFIGURED) {
    return res.status(501).json({ success: false, error: 'Google OAuth 未配置' })
  }

  const { idToken } = req.body
  if (!idToken) {
    return res.status(400).json({ success: false, error: 'Google ID Token 不能为空' })
  }

  const googleUser = await verifyGoogleToken(idToken)
  if (!googleUser) {
    return res.status(401).json({ success: false, error: 'Google 登录验证失败' })
  }

  let user = await getUserByEmail(googleUser.email)

  if (user) {
    if (user.authProvider !== 'google') {
      return res.status(400).json({ success: false, error: `该邮箱已使用 ${user.authProvider} 方式注册` })
    }
    user.lastLoginAt = new Date().toISOString()
    user.updatedAt = new Date().toISOString()
    if (googleUser.picture) user.avatar = googleUser.picture
    await saveUser(user)
  } else {
    const userId = crypto.randomUUID()
    user = {
      id: userId,
      email: googleUser.email,
      username: googleUser.name || generateRandomUsername(),
      avatar: googleUser.picture || generateRandomAvatar(userId, 'personas'),
      authProvider: 'google',
      googleId: googleUser.googleId,
      emailVerified: googleUser.emailVerified,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      status: 'active',
      roles: { admin: googleUser.email === 'caitlinyct@gmail.com' }
    }
    await saveUser(user)
  }

  const token = generateToken({ userId: user.id, email: user.email })
  return res.status(200).json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: '登录成功'
  })
}

/**
 * 获取当前用户
 */
async function handleGetMe(req, res) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' })
  }

  const payload = verifyToken(token)
  if (!payload || !payload.userId) {
    return res.status(401).json({ success: false, error: '认证令牌无效或已过期' })
  }

  const user = await getUserById(payload.userId)
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: '账户已被停用' })
  }

  return res.status(200).json({ success: true, user: sanitizeUser(user) })
}

/**
 * 更新用户资料
 */
async function handleUpdateProfile(req, res) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' })
  }

  const payload = verifyToken(token)
  if (!payload || !payload.userId) {
    return res.status(401).json({ success: false, error: '认证令牌无效或已过期' })
  }

  const user = await getUserById(payload.userId)
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: '账户已被停用' })
  }

  const { username, fullName, title, location, targetRole, phone, bio } = req.body

  if (username !== undefined && typeof username === 'string' && username.trim().length > 0) {
    user.username = username.trim()
  }

  if (!user.profile) user.profile = {}
  if (fullName !== undefined) user.profile.fullName = typeof fullName === 'string' ? fullName.trim() : undefined
  if (title !== undefined) user.profile.title = typeof title === 'string' ? title.trim() : undefined
  if (location !== undefined) user.profile.location = typeof location === 'string' ? location.trim() : undefined
  if (targetRole !== undefined) user.profile.targetRole = typeof targetRole === 'string' ? targetRole.trim() : undefined
  if (phone !== undefined) user.profile.phone = typeof phone === 'string' ? phone.trim() : undefined
  if (bio !== undefined) user.profile.bio = typeof bio === 'string' ? bio.trim() : undefined

  user.updatedAt = new Date().toISOString()

  const { success } = await saveUser(user)
  if (!success) {
    return res.status(500).json({ success: false, error: '更新失败，请稍后重试' })
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(user),
    message: '资料更新成功'
  })
}

/**
 * 验证邮箱
 */
async function handleVerifyEmail(req, res) {
  const { email, token } = req.body

  if (!email || !token) {
    return res.status(400).json({ success: false, error: '邮箱和验证令牌不能为空' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式无效' })
  }

  const user = await getUserByEmail(email)
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  if (user.emailVerified) {
    return res.status(200).json({
      success: true,
      message: '邮箱已验证',
      user: sanitizeUser(user)
    })
  }

  if (user.verificationToken !== token) {
    return res.status(400).json({ success: false, error: '验证令牌无效' })
  }

  if (isTokenExpired(user.verificationExpires)) {
    return res.status(400).json({ success: false, error: '验证令牌已过期' })
  }

  user.emailVerified = true
  user.verificationToken = undefined
  user.verificationExpires = undefined
  user.updatedAt = new Date().toISOString()

  const { success } = await saveUser(user)
  if (!success) {
    return res.status(500).json({ success: false, error: '验证失败' })
  }

  return res.status(200).json({
    success: true,
    message: '邮箱验证成功！',
    user: sanitizeUser(user)
  })
}

/**
 * 重新发送验证邮件
 */
async function handleResendVerification(req, res) {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ success: false, error: '邮箱不能为空' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '邮箱格式无效' })
  }

  const user = await getUserByEmail(email)
  if (!user) {
    return res.status(200).json({
      success: true,
      message: '如果该邮箱已注册，验证邮件将发送到您的邮箱'
    })
  }

  if (user.emailVerified) {
    return res.status(200).json({ success: true, message: '该邮箱已验证' })
  }

  user.verificationToken = generateVerificationToken()
  user.verificationExpires = generateVerificationExpiry()
  user.updatedAt = new Date().toISOString()

  await saveUser(user)

  if (isEmailServiceConfigured()) {
    await sendVerificationEmail(email, user.username, user.verificationToken)
  }

  return res.status(200).json({
    success: true,
    message: isEmailServiceConfigured() ? '验证邮件已发送' : '验证邮件已发送（开发环境）'
  })
}

// subscribe job alerts
async function handleSubscribe(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const { channel, identifier, topic } = req.body || {}
  if (!channel || !identifier || !topic) {
    return res.status(400).json({ success: false, error: 'Missing fields' })
  }
  const key = `haigoo:subscribe:${channel}:${identifier}`
  const data = { channel, identifier, topic, createdAt: new Date().toISOString() }
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(key, data)
      await kv.sadd('haigoo:subscribe:list', key)
    } else {
      const r = await getRedis()
      if (r) {
        await r.set(key, JSON.stringify(data))
        await r.sAdd('haigoo:subscribe:list', key)
      }
    }
    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}

// copilot analysis (baseline)
async function handleCopilot(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const { resume = '' } = req.body || {}
  const text = String(resume).toLowerCase()
  const analysis = []
  if (text.includes('react')) analysis.push('Strong frontend experience (React)')
  if (text.includes('python')) analysis.push('Backend/Data skills with Python')
  if (text.includes('ml') || text.includes('machine learning')) analysis.push('Machine learning exposure detected')
  if (analysis.length === 0) analysis.push('General software experience; add role-specific keywords to improve matching')
  const optimization = [
    'Quantify achievements (metrics, %, time saved)',
    'Add role keywords (e.g., product, algorithm, operations, marketing where relevant)',
    'Highlight remote collaboration tools and async communication',
    'Include links to portfolio or GitHub for evidence'
  ]
  const tips = [
    'Tailor resume to each job; mirror job requirements',
    'Use concise paragraphs and bullet points',
    'Write a short cover letter focusing on impact and fit',
    'Submit during local business hours of hiring company'
  ]
  return res.status(200).json({ success: true, matchAnalysis: analysis, optimization, tips })
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { action } = req.query

    switch (action) {
      case 'register':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleRegister(req, res)

      case 'login':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleLogin(req, res)

      case 'google':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleGoogleLogin(req, res)

      case 'me':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
        return await handleGetMe(req, res)

      case 'update-profile':
        if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
        return await handleUpdateProfile(req, res)

      case 'verify-email':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleVerifyEmail(req, res)

      case 'resend-verification':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleResendVerification(req, res)

      case 'subscribe':
        return await handleSubscribe(req, res)

      case 'copilot':
        return await handleCopilot(req, res)

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          availableActions: ['register', 'login', 'google', 'me', 'update-profile', 'verify-email', 'resend-verification', 'subscribe', 'copilot']
        })
    }
  } catch (error) {
    console.error('[auth] Error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

