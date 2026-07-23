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
import { getUserByEmail, getUserById, saveUser, updateUser, deleteUserById } from '../server-utils/user-helper.js'
import { sendVerificationEmail, sendPasswordResetEmail, isEmailServiceConfigured } from '../server-utils/email-service.js'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'crypto'
import neonHelper from '../server-utils/dal/neon-helper.js'
import { SUPER_ADMIN_EMAILS } from '../server-utils/admin-config.js'
import { subscriptionsService } from '../lib/services/subscriptions-service.js'
import { isMembershipActive } from '../lib/shared/membership.js'
import { MAX_SUBSCRIPTION_TOPICS } from '../lib/shared/subscription-limits.js'

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CONFIGURED ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
const LEGACY_SUBSCRIPTION_TOPIC_MAP = {
  'full-stack': '全栈开发',
  frontend: '前端开发',
  backend: '后端开发',
  mobile: '移动开发',
  devops: '运维/SRE',
  qa: '测试/QA',
  security: '网络安全',
  data: '数据分析',
  'ai-ml': '算法工程师',
  'product-management': '产品经理',
  'project-management': '项目管理',
  'ui-ux': 'UI/UX设计',
  marketing: '市场营销',
  sales: '销售',
  content: '内容创作',
  'customer-support': '客户服务',
  hr: '人力资源',
  finance: '财务',
  legal: '法务'
}
function isSuperAdminEmail(email) {
  return !!email && SUPER_ADMIN_EMAILS.includes(String(email).trim().toLowerCase())
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function matchesPasswordResetToken(token, storedHash) {
  const candidate = Buffer.from(hashPasswordResetToken(token), 'hex')
  const stored = Buffer.from(String(storedHash || ''), 'hex')
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored)
}

function authRateLimitKeys(req, action, email) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  const client = forwarded || String(req.headers?.['x-real-ip'] || '').trim()
  return [
    ['email', String(email || '').trim().toLowerCase()],
    ['client', client]
  ]
    .filter(([, value]) => value)
    .map(([dimension, value]) => (
      crypto.createHash('sha256').update(`${action}:${dimension}:${value}`).digest('hex')
    ))
}

async function consumeAuthRateLimit(req, res, { action, email, limit, windowSeconds }) {
  // Mini Gateway already applies OpenID/email/IP limits before invoking this
  // handler in-process. Do not double-count the same email dimension.
  if (req.trustedMiniGateway === true) return { allowed: true, keyHashes: [] }
  if (!neonHelper.isConfigured) return { allowed: true, keyHashes: [] }
  const keyHashes = authRateLimitKeys(req, action, email)
  if (!keyHashes.length) return { allowed: true, keyHashes: [] }

  await neonHelper.query(
    `DELETE FROM mini_rate_limits WHERE updated_at < NOW() - INTERVAL '2 days'`
  )
  const results = await Promise.all(keyHashes.map((keyHash) => neonHelper.query(
    `INSERT INTO mini_rate_limits (
        key_hash, action, attempts, window_started_at, updated_at
     ) VALUES ($1, $2, 1, NOW(), NOW())
     ON CONFLICT (key_hash, action)
     DO UPDATE SET
       attempts = CASE
         WHEN mini_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN 1
         ELSE mini_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN mini_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 second') THEN NOW()
         ELSE mini_rate_limits.window_started_at
       END,
       updated_at = NOW()
     RETURNING attempts, window_started_at`,
    [keyHash, action, windowSeconds]
  )))
  const exceeded = results
    .map((rows) => rows?.[0])
    .filter((row) => Number(row?.attempts || 0) > limit)
  if (!exceeded.length) return { allowed: true, keyHashes }

  const oldestWindow = Math.min(...exceeded.map((row) => new Date(row.window_started_at).getTime()))
  const retryAfter = Math.max(1, Math.ceil((oldestWindow + windowSeconds * 1000 - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfter))
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    error: '操作过于频繁，请稍后再试',
    retryAfter
  })
  return { allowed: false, keyHashes }
}

async function clearAuthRateLimit(keyHashes, action) {
  if (!neonHelper.isConfigured || !keyHashes?.length) return
  await neonHelper.query(
    'DELETE FROM mini_rate_limits WHERE key_hash = ANY($1::text[]) AND action = $2',
    [keyHashes, action]
  )
}

function normalizeSubscriptionTopics(input, topic) {
  const source = Array.isArray(input)
    ? input
    : String(topic || '').split(',')

  return [...new Set(source
    .map(item => String(item || '').trim())
    .map(item => LEGACY_SUBSCRIPTION_TOPIC_MAP[item] || item)
    .filter(Boolean)
  )]
}

function normalizeSubscriptionCustomTopics(input, customTopic) {
  const source = Array.isArray(input)
    ? input
    : String(customTopic || '').split(',')
  const seen = new Set()

  return source
    .map(item => String(item || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase().replace(/\s+/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function countStandardSubscriptionTopics(topics) {
  return (Array.isArray(topics) ? topics : []).filter(item => item !== 'other').length
}

// CORS headers
function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://haigoo-admin.vercel.app',
    'https://www.haigooremote.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function getActiveDeletedAccountLock(email) {
  if (!neonHelper?.isConfigured || !email) return null

  try {
    const rows = await neonHelper.query(
      `SELECT email, blocked_until
         FROM deleted_account_locks
        WHERE LOWER(email) = LOWER($1)
          AND blocked_until > NOW()
        ORDER BY blocked_until DESC
        LIMIT 1`,
      [String(email).trim().toLowerCase()]
    )
    return rows?.[0] || null
  } catch (error) {
    console.error('[auth] Failed to check deleted account lock:', error)
    return null
  }
}

function buildDeletedAccountLockMessage(lockRow) {
  if (!lockRow?.blocked_until) {
    return '该邮箱近期已注销账号，30天内无法重新注册。如需帮助请联系 hi@haigooremote.com'
  }

  const blockedUntil = new Date(lockRow.blocked_until)
  const label = Number.isNaN(blockedUntil.getTime())
    ? '30天后'
    : new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(blockedUntil)

  return `该邮箱近期已注销账号，请在 ${label} 后重新注册。如需帮助请联系 hi@haigooremote.com`
}

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

  const normalizedEmail = email.toLowerCase()
  const rateLimit = await consumeAuthRateLimit(req, res, {
    action: 'register',
    email: normalizedEmail,
    limit: 3,
    windowSeconds: 60 * 60
  })
  if (!rateLimit.allowed) return

  const deletedAccountLock = await getActiveDeletedAccountLock(normalizedEmail)
  if (deletedAccountLock) {
    return res.status(403).json({ success: false, error: buildDeletedAccountLockMessage(deletedAccountLock) })
  }

  const emailExists = await getUserByEmail(normalizedEmail)
  if (emailExists) {
    if (!emailExists.emailVerified) {
      if (isTokenExpired(emailExists.verificationExpires)) {
        // Delete expired unverified account and proceed as new user
        await deleteUserById(emailExists.user_id)
        console.log(`[auth] Deleted expired unverified account: ${emailExists.user_id}`)
        // Fall through to register
      } else {
        return res.status(409).json({ success: false, error: '该邮箱已注册但尚未验证，请查看您的收件箱。如需重新注册请等待24小时验证过期。' })
      }
    } else {
      return res.status(409).json({ success: false, error: '该邮箱已被注册' })
    }
  }

  const userId = crypto.randomUUID()
  const finalUsername = username || generateRandomUsername()
  const avatar = generateRandomAvatar(userId, 'personas')
  const passwordHash = await hashPassword(password)
  const verificationToken = generateVerificationToken()
  const verificationExpires = generateVerificationExpiry()

  const user = {
    user_id: userId,
    email: normalizedEmail,
    username: finalUsername,
    avatar,
    auth_provider: 'email',
    password_hash: passwordHash,
    email_verified: false,
    verification_token: verificationToken,
    verification_expires: verificationExpires,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: null,
    status: 'active',
    roles: {
      admin: isSuperAdminEmail(normalizedEmail)
    },
    profile: null
  }

  const { success } = await saveUser(user)
  if (!success) {
    return res.status(500).json({ success: false, error: '注册失败，请稍后重试' })
  }

  console.log(`[auth] New user registered: ${userId}`)

  if (neonHelper.isConfigured) {
    try {
      await neonHelper.query(
        'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
        ['user_register', '新用户注册', `用户邮箱: ${email}\n用户名: ${finalUsername}`]
      )
    } catch (e) {
      console.error('[auth] Failed to insert admin message for user register', e)
    }
  }

  let verificationEmailSent = false
  if (isEmailServiceConfigured()) {
    try {
      await sendVerificationEmail(email, finalUsername, verificationToken)
      verificationEmailSent = true
    } catch (error) {
      // Account creation has already committed. Returning a 500 here makes
      // clients retry registration and hit an unavoidable email conflict.
      console.error('[auth] Failed to send registration verification email:', error)
    }
  }

  const token = generateToken({
    userId,
    email: normalizedEmail,
    role: user.roles?.admin ? 'admin' : 'user',
    isAdmin: !!user.roles?.admin
  })
  return res.status(201).json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: verificationEmailSent
      ? '注册成功！请查收验证邮件'
      : isEmailServiceConfigured()
        ? '注册成功，但验证邮件暂时未发出，请稍后在网站重新发送'
        : '注册成功！',
    emailDeliveryFailed: isEmailServiceConfigured() && !verificationEmailSent
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

  const normalizedEmail = email.toLowerCase()
  const rateLimit = await consumeAuthRateLimit(req, res, {
    action: 'login',
    email: normalizedEmail,
    limit: 5,
    windowSeconds: 15 * 60
  })
  if (!rateLimit.allowed) return

  const user = await getUserByEmail(normalizedEmail)
  if (!user) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
  }
  // 验证密码
  const passwordMatch = await comparePassword(password, user.passwordHash)
  if (!passwordMatch) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
  }

  // Force admin role for test user (Temporary fix for local dev)
  if (normalizedEmail === 'test@example.com') {
    console.log('[Auth] Force updating admin role for test user')
    if (!user.roles || !user.roles.admin) {
      user.roles = { ...user.roles, admin: true }
      await saveUser(user)
      console.log('[Auth] Admin role updated and saved')
    }
  }

  if (isSuperAdminEmail(normalizedEmail)) {
    console.log(`[Auth] Force updating super admin privileges for ${normalizedEmail}`)
    let needsUpdate = false

    // Ensure admin role
    if (!user.roles || !user.roles.admin) {
      user.roles = { ...user.roles, admin: true }
      needsUpdate = true
    }

    // Ensure Club membership
    const now = new Date()
    const nextYear = new Date(now.setFullYear(now.getFullYear() + 1))

    if (user.membership_level !== 'vip') {
      user.membership_level = 'vip'
      user.membership_expire_at = nextYear.toISOString()
      needsUpdate = true
    }

    if (needsUpdate) {
      // Use updateUser helper if available or saveUser
      // Since saveUser is likely neon helper call, we should use updateUser for consistency if possible
      // But here we might just want to use the internal save mechanism.
      // Assuming saveUser or updateUser handles this.
      // Let's use updateUser to be safe with DB schema.
      try {
        await updateUser(user.user_id, {
          roles: user.roles,
          membershipLevel: 'vip',
          membershipExpireAt: nextYear.toISOString()
        }, { isAdmin: true })
        console.log('[Auth] Super admin privileges updated and saved')
      } catch (err) {
        console.error('[Auth] Failed to update super admin privileges:', err)
      }
    }
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: '账户已被停用' })
  }

  // 使用统一的更新函数更新最后登录时间
  await updateUser(user.user_id, { lastLoginAt: true })
  await clearAuthRateLimit(rateLimit.keyHashes, 'login')

  console.log(`[auth] User logged in: ${user.user_id}`)

  if (isSuperAdminEmail(normalizedEmail) && !user.roles?.admin) {
    user.roles = { ...(user.roles || {}), admin: true }
  }

  const token = generateToken({
    userId: user.user_id,
    email: user.email,
    role: user.roles?.admin ? 'admin' : 'user',
    isAdmin: !!user.roles?.admin
  })
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

  const deletedAccountLock = await getActiveDeletedAccountLock(googleUser.email)
  if (deletedAccountLock) {
    return res.status(403).json({ success: false, error: buildDeletedAccountLockMessage(deletedAccountLock) })
  }

  const googleEmail = String(googleUser.email || '').trim().toLowerCase()
  let user = await getUserByEmail(googleEmail)

  if (user) {
    if (user.auth_provider !== 'google') {
      return res.status(400).json({ success: false, error: `该邮箱已使用 ${user.auth_provider} 方式注册` })
    }
    if (isSuperAdminEmail(googleEmail) && !user.roles?.admin) {
      user.roles = { ...(user.roles || {}), admin: true }
      await updateUser(user.user_id, { roles: user.roles }, { isAdmin: true })
    }
    // 使用统一的更新函数更新最后登录时间 (不再覆盖头像，保持 Haigoo 系列头像)
    await updateUser(user.user_id, {
      lastLoginAt: true
    })
  } else {
    const userId = crypto.randomUUID()
    user = {
      user_id: userId,
      email: googleEmail,
      username: googleUser.name || generateRandomUsername(),
      // 统一使用 Haigoo 系列头像
      avatar: generateRandomAvatar(userId),
      auth_provider: 'google',
      google_id: googleUser.googleId,
      email_verified: googleUser.emailVerified,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      status: 'active',
      roles: { admin: isSuperAdminEmail(googleEmail) },
      profile: null
    }
    await saveUser(user)

    // Log the new registration in the admin dashboard
    if (neonHelper.isConfigured) {
      try {
        await neonHelper.query(
          'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
          ['user_register', '新用户注册', `用户邮箱: ${googleEmail}\n用户名: ${user.username}`]
        )
      } catch (e) {
        console.error('[auth] Failed to insert admin message for Google sign up', e)
      }
    }
  }

  const token = generateToken({
    userId: user.user_id,
    email: user.email,
    role: user.roles?.admin ? 'admin' : 'user',
    isAdmin: !!user.roles?.admin
  })
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

  // 使用统一的更新函数更新用户资料
  const { success, user: updatedUser } = await updateUser(payload.userId, {
    username,
    fullName,
    title,
    location,
    targetRole,
    phone,
    bio
  })

  if (!success) {
    return res.status(500).json({ success: false, error: '更新失败，请稍后重试' })
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(updatedUser),
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

  const user = await getUserByEmail(email.toLowerCase())
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  if (user.email_verified) {
    return res.status(200).json({
      success: true,
      message: '邮箱已验证',
      user: sanitizeUser(user)
    })
  }

  if (user.verification_token !== token) {
    return res.status(400).json({ success: false, error: '验证令牌无效' })
  }

  if (isTokenExpired(user.verification_expires)) {
    return res.status(400).json({ success: false, error: '验证令牌已过期' })
  }

  // 使用统一的更新函数更新邮箱验证状态
  const { success } = await updateUser(user.user_id, {
    emailVerified: true,
    verificationToken: null,
    verificationExpires: null
  })

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

  const user = await getUserByEmail(email.toLowerCase())
  if (!user) {
    return res.status(200).json({
      success: true,
      message: '如果该邮箱已注册，验证邮件将发送到您的邮箱'
    })
  }

  if (user.emailVerified) {
    return res.status(200).json({ success: true, message: '该邮箱已验证' })
  }

  const newToken = generateVerificationToken()
  const newExpires = generateVerificationExpiry()

  const { success } = await updateUser(user.user_id, {
    verificationToken: newToken,
    verificationExpires: newExpires
  })

  if (!success) {
    return res.status(500).json({ success: false, error: '内部错误，无法保存验证令牌' })
  }

  if (isEmailServiceConfigured()) {
    await sendVerificationEmail(email, user.username, newToken)
  }

  return res.status(200).json({
    success: true,
    message: isEmailServiceConfigured() ? '验证邮件已发送' : '验证邮件已发送（开发环境）'
  })
}

/**
 * 获取当前用户的订阅
 */
async function handleGetSubscriptions(req, res) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ success: false, error: '未授权' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ success: false, error: '无效令牌' })

  try {
    const user = await getUserById(payload.userId)
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' })

    const result = await subscriptionsService.getForUser(user)

    return res.status(200).json({ success: true, subscriptions: result || [] })
  } catch (error) {
    console.error('[auth] Get subscriptions error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

/**
 * 更新订阅 (用户端)
 */
async function handleUpdateSubscription(req, res) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ success: false, error: '未授权' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ success: false, error: '无效令牌' })

  const { id, topic, topics, customTopic, customTopics, status } = req.body
  if (!id) return res.status(400).json({ success: false, error: '订阅ID不能为空' })

  try {
    // 验证所有权
    const user = await getUserById(payload.userId)
    const sub = await neonHelper.select('subscriptions', { subscription_id: id })

    if (!sub || sub.length === 0) {
      return res.status(404).json({ success: false, error: '订阅不存在' })
    }

    const subscription = sub[0]
    // 允许修改如果：user_id 匹配，或者 identifier 是用户的邮箱
    if (subscription.user_id !== user.user_id && subscription.identifier !== user.email) {
      return res.status(403).json({ success: false, error: '无权修改此订阅' })
    }

    if ((topic || topics || status === 'active') && !isMembershipActive(user)) {
      return res.status(403).json({ success: false, error: '该功能仅对会员开放，请先升级会员' })
    }

    const normalizedTopics = normalizeSubscriptionTopics(topics, topic)
    const normalizedCustomTopics = normalizeSubscriptionCustomTopics(customTopics, customTopic)
    const shouldUpdateTopic = Boolean(topic || topics || normalizedCustomTopics.length)
    let nextTopic = null
    let nextPreferences = null
    if (shouldUpdateTopic) {
      if (countStandardSubscriptionTopics(normalizedTopics) + normalizedCustomTopics.length === 0) {
        return res.status(400).json({ success: false, error: '请至少选择一个岗位方向' })
      }
      if (countStandardSubscriptionTopics(normalizedTopics) + normalizedCustomTopics.length > MAX_SUBSCRIPTION_TOPICS) {
        return res.status(400).json({ success: false, error: '已触达订阅上限，无法继续添加' })
      }
      nextTopic = [...normalizedTopics, ...normalizedCustomTopics].filter(Boolean).join(',')
      nextPreferences = {
        topics: normalizedTopics,
        customTopic: normalizedCustomTopics[0] || null,
        customTopics: normalizedCustomTopics,
        source: 'home_member_email_subscription',
        updatedBy: user.user_id
      }
    }

    const nextStatus = status ? (status === 'active' ? 'active' : 'inactive') : null
    const updated = await neonHelper.query(
      `UPDATE subscriptions
          SET topic = CASE WHEN $1::boolean THEN $2 ELSE topic END,
              preferences = CASE WHEN $1::boolean THEN $3::jsonb ELSE preferences END,
              status = COALESCE($4::text, status),
              user_id = COALESCE(user_id, $5),
              last_active_at = CASE WHEN $4::text = 'active' THEN NOW() ELSE last_active_at END,
              updated_at = NOW()
        WHERE subscription_id = $6
        RETURNING *`,
      [shouldUpdateTopic, nextTopic, JSON.stringify(nextPreferences || {}), nextStatus, user.user_id, id]
    )
    return res.status(200).json({ success: true, message: '更新成功', subscription: updated?.[0] || null })
  } catch (error) {
    console.error('[auth] Update subscription error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

/**
 * 删除订阅 (用户端)
 */
async function handleDeleteSubscription(req, res) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ success: false, error: '未授权' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ success: false, error: '无效令牌' })

  const { id } = req.body
  if (!id) return res.status(400).json({ success: false, error: '订阅ID不能为空' })

  try {
    const user = await getUserById(payload.userId)
    const sub = await neonHelper.select('subscriptions', { subscription_id: id })

    if (!sub || sub.length === 0) {
      return res.status(404).json({ success: false, error: '订阅不存在' })
    }

    const subscription = sub[0]
    if (subscription.user_id !== user.user_id && subscription.identifier !== user.email) {
      return res.status(403).json({ success: false, error: '无权删除此订阅' })
    }

    await subscriptionsService.softDelete(id)

    return res.status(200).json({ success: true, message: '已取消订阅' })
  } catch (error) {
    console.error('[auth] Delete subscription error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

/**
 * 处理用户订阅
 */
async function handleSubscribe(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const token = extractToken(req)
  if (!token) return res.status(401).json({ success: false, error: '未授权' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ success: false, error: '无效令牌' })

  try {
    const user = await getUserById(payload.userId)
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' })
    if (!isMembershipActive(user)) {
      return res.status(403).json({ success: false, error: '该功能仅对会员开放，请先升级会员' })
    }

    const topics = normalizeSubscriptionTopics(req.body?.topics, req.body?.topic)
    const customTopics = normalizeSubscriptionCustomTopics(req.body?.customTopics, req.body?.customTopic)
    if (countStandardSubscriptionTopics(topics) + customTopics.length === 0) {
      return res.status(400).json({ success: false, error: '请至少选择一个岗位方向' })
    }
    if (countStandardSubscriptionTopics(topics) + customTopics.length > MAX_SUBSCRIPTION_TOPICS) {
      return res.status(400).json({ success: false, error: '已触达订阅上限，无法继续添加' })
    }

    const subscription = await subscriptionsService.upsertForUser(user, {
      topics,
      customTopic: customTopics[0] || '',
      customTopics
    })

    return res.status(200).json({
      success: true,
      message: '订阅已保存',
      subscription
    })
  } catch (error) {
    console.error('[auth] Subscribe error:', error)
    if (error?.code === 'SUBSCRIPTION_TOPIC_LIMIT') {
      return res.status(400).json({ success: false, error: '已触达订阅上限，无法继续添加' })
    }
    return res.status(500).json({ success: false, error: '服务器错误' })
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
 * 通过邮箱取消订阅
 */
async function handleUnsubscribeByEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const { email } = req.body
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' })

  try {
    if (neonHelper.isConfigured) {
      await neonHelper.query(
        `UPDATE subscriptions
            SET status = 'inactive',
                updated_at = NOW()
          WHERE channel = 'email'
            AND LOWER(identifier) = LOWER($1)`,
        [email]
      )
    }
  } catch (error) {
    console.error('[auth] Unsubscribe by email error:', error)
  }

  return res.status(200).json({ success: true, message: '已取消邮件订阅', email })
}

/**
 * 请求重置密码
 */
async function handleRequestPasswordReset(req, res) {
  const { email } = req.body
  const genericMessage = '如果该邮箱已注册，重置邮件将发送到您的邮箱'

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: '请输入有效邮箱' })
  }

  const normalizedEmail = email.toLowerCase()
  const rateLimit = await consumeAuthRateLimit(req, res, {
    action: 'request_password_reset',
    email: normalizedEmail,
    limit: 3,
    windowSeconds: 60 * 60
  })
  if (!rateLimit.allowed) return

  const user = await getUserByEmail(normalizedEmail)
  if (!user) {
    return res.status(200).json({ success: true, message: genericMessage })
  }

  const resetToken = generateVerificationToken()
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const updateResult = await updateUser(user.user_id, {
    resetToken: hashPasswordResetToken(resetToken),
    resetExpires
  })
  if (!updateResult?.success) {
    console.error('[auth] Failed to persist password reset token')
    return res.status(200).json({ success: true, message: genericMessage })
  }

  try {
    if (isEmailServiceConfigured()) {
      await sendPasswordResetEmail(email, user.username, resetToken)
    } else {
      console.error('[auth] Password reset requested while email service is not configured')
    }
  } catch (error) {
    // Do not reveal whether an account exists through a different status,
    // message or timing-dependent retry path.
    console.error('[auth] Failed to send password reset email:', error)
  }

  return res.status(200).json({ success: true, message: genericMessage })
}

/**
 * 重置密码
 */
async function handleResetPassword(req, res) {
  const { email, token, newPassword } = req.body

  if (!email || !token || !newPassword) {
    return res.status(400).json({ success: false, error: '缺少必要参数' })
  }

  const user = await getUserByEmail(email.toLowerCase())
  if (!user) {
    return res.status(400).json({ success: false, error: '重置令牌无效或已过期' })
  }

  if (!matchesPasswordResetToken(token, user.reset_token)) {
    return res.status(400).json({ success: false, error: '重置令牌无效或已过期' })
  }

  if (isTokenExpired(user.reset_expires)) {
    return res.status(400).json({ success: false, error: '重置令牌无效或已过期' })
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ success: false, error: '密码至少8位，且包含字母和数字' })
  }

  const passwordHash = await hashPassword(newPassword)

  // 更新密码并清除 token
  const updateResult = await updateUser(user.user_id, {
    passwordHash,
    resetToken: null,
    resetExpires: null
  })
  if (!updateResult?.success) {
    return res.status(500).json({ success: false, error: '密码重置失败，请稍后重试' })
  }

  return res.status(200).json({ success: true, message: '密码重置成功，请使用新密码登录' })
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res, req)

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

      case 'get-subscriptions':
      case 'my-subscriptions':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
        return await handleGetSubscriptions(req, res)

      case 'update-subscription':
        if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
        return await handleUpdateSubscription(req, res)

      case 'delete-subscription':
        if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
        return await handleDeleteSubscription(req, res)

      case 'unsubscribe-by-email':
        return await handleUnsubscribeByEmail(req, res)

      case 'copilot':
        return await handleCopilot(req, res)

      case 'request-password-reset':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleRequestPasswordReset(req, res)

      case 'reset-password':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleResetPassword(req, res)

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
