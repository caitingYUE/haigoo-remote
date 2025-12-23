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
import { getUserByEmail, getUserById, saveUser, updateUser } from '../server-utils/user-helper.js'
import { sendVerificationEmail, sendSubscriptionWelcomeEmail, isEmailServiceConfigured } from '../server-utils/email-service.js'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'crypto'
import neonHelper from '../server-utils/dal/neon-helper.js'

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
    user_id: userId,
    email,
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
      admin: email === 'caitlinyct@gmail.com' || email === 'mrzhangzy1996@gmail.com'
    },
    profile: null
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
  console.log(`[auth] User found: ${JSON.stringify(user)}`)

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

  // Force super admin privileges for caitlinyct@gmail.com
  if (email === 'caitlinyct@gmail.com') {
    console.log('[Auth] Force updating super admin privileges for caitlinyct@gmail.com')
    let needsUpdate = false
    
    // Ensure admin role
    if (!user.roles || !user.roles.admin) {
      user.roles = { ...user.roles, admin: true }
      needsUpdate = true
    }

    // Ensure VIP membership
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
        })
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

  console.log(`[auth] User logged in: ${email}`)

  const token = generateToken({ userId: user.user_id, email: user.email })
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
    if (user.auth_provider !== 'google') {
    return res.status(400).json({ success: false, error: `该邮箱已使用 ${user.auth_provider} 方式注册` })
  }
    // 使用统一的更新函数更新最后登录时间 (不再覆盖头像，保持 Haigoo 系列头像)
    await updateUser(user.user_id, { 
      lastLoginAt: true
    })
  } else {
    const userId = crypto.randomUUID()
    user = {
      user_id: userId,
      email: googleUser.email,
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
      roles: { admin: googleUser.email === 'caitlinyct@gmail.com' || googleUser.email === 'mrzhangzy1996@gmail.com' },
      profile: null
    }
    await saveUser(user)
  }

  const token = generateToken({ userId: user.user_id, email: user.email })
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

  const user = await getUserByEmail(email)
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

  user.verification_token = generateVerificationToken()
  user.verification_expires = generateVerificationExpiry()
  user.updated_at = new Date().toISOString()

  await saveUser(user)

  if (isEmailServiceConfigured()) {
    await sendVerificationEmail(email, user.username, user.verificationToken)
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

    // 查询条件：user_id 匹配 或 identifier 匹配邮箱
    // 注意：neonHelper.select 只能处理简单的 AND 条件，这里我们需要写原生 SQL 来处理 OR
    const query = `
      SELECT * FROM subscriptions 
      WHERE user_id = $1 OR (channel = 'email' AND identifier = $2)
      ORDER BY created_at DESC
    `
    const result = await neonHelper.query(query, [user.user_id, user.email])
    
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

  const { id, topic, status } = req.body
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

    const updates = { updated_at: new Date().toISOString() }
    if (topic) updates.topic = topic
    if (status) updates.status = status
    
    // 如果订阅没有 user_id，顺便关联上
    if (!subscription.user_id) updates.user_id = user.user_id

    await neonHelper.update('subscriptions', updates, { subscription_id: id })
    return res.status(200).json({ success: true, message: '更新成功' })
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

    // 物理删除? 还是标记删除? 题目说"取消"，通常可以物理删除或者 status='inactive'
    // 这里选择物理删除，或者如果用户希望"取消"是暂时停止，可以用 status='inactive'
    // 既然有 DELETE method，通常是物理删除。但如果是取消订阅，status='inactive' 更好保留记录。
    // 但是 api/admin/subscriptions.js 支持 DELETE。
    // 这里我们直接 DELETE 吧，简单。
    const query = `DELETE FROM subscriptions WHERE subscription_id = $1`
    await neonHelper.query(query, [id])
    
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
  
  const { channel, identifier, topic, nickname } = req.body || {}
  if (!channel || !identifier) {
    return res.status(400).json({ success: false, error: '缺少必要字段' })
  }

  // 验证不同渠道的必填项
  if (channel === 'email' && !topic) {
    return res.status(400).json({ success: false, error: '邮箱订阅需要选择岗位类型' })
  }
  if (channel === 'feishu' && !nickname) {
    return res.status(400).json({ success: false, error: '飞书订阅需要提供昵称' })
  }

  try {
    // 尝试查找用户以关联 user_id
    let userId = null
    if (channel === 'email') {
        const user = await getUserByEmail(identifier)
        if (user) userId = user.user_id
    } else if (channel === 'feishu') {
        // 尝试通过手机号查找用户 (手机号存储在 profile JSON 中)
        const query = `SELECT user_id FROM users WHERE profile->>'phone' = $1 LIMIT 1`
        const result = await neonHelper.query(query, [identifier])
        if (result && result.length > 0) {
            userId = result[0].user_id
        }
    }

    // 检查订阅是否已存在
    const existingSubscription = await neonHelper.select('subscriptions', { 
      channel, 
      identifier 
    })

    if (existingSubscription && existingSubscription.length > 0) {
      // 清理重复订阅 (如果存在多个，保留第一个，删除其他的)
      if (existingSubscription.length > 1) {
         console.log(`[auth] Found ${existingSubscription.length} duplicate subscriptions for ${identifier}, cleaning up...`)
         const idsToDelete = existingSubscription.slice(1).map(s => s.subscription_id)
         for (const id of idsToDelete) {
             await neonHelper.query('DELETE FROM subscriptions WHERE subscription_id = $1', [id])
         }
      }

      // 更新现有订阅
      const subscriptionId = existingSubscription[0].subscription_id
      const updates = { 
          status: 'active', // 重新激活
          updated_at: new Date().toISOString() 
      }
      
      // 根据渠道更新特定字段
      if (channel === 'email') updates.topic = topic
      if (channel === 'feishu') updates.nickname = nickname

      if (userId && !existingSubscription[0].user_id) {
          updates.user_id = userId
      }

      await neonHelper.update('subscriptions', updates, { subscription_id: subscriptionId })
    } else {
      // 创建新订阅
      const subscriptionId = crypto.randomUUID()
      const newSub = {
        subscription_id: subscriptionId,
        channel,
        identifier,
        user_id: userId, // 关联用户
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (channel === 'email') newSub.topic = topic
      if (channel === 'feishu') newSub.nickname = nickname

      await neonHelper.insert('subscriptions', newSub)
    }

    // 发送欢迎邮件 (仅当渠道为 email 时)
    if (channel === 'email' && isEmailServiceConfigured()) {
        try {
            await sendSubscriptionWelcomeEmail(identifier, topic)
            console.log(`[auth] Subscription welcome email sent to ${identifier}`)
        } catch (emailError) {
            console.error('[auth] Failed to send subscription welcome email:', emailError)
        }
    }

    return res.status(200).json({ success: true, message: '订阅成功' })
  } catch (error) {
    console.error('[auth] Subscription error:', error)
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
    // 删除该邮箱关联的所有订阅 (包括 email 渠道订阅，以及该邮箱对应用户的订阅)
    const query = `
      DELETE FROM subscriptions 
      WHERE (channel = 'email' AND identifier = $1) 
      OR user_id IN (SELECT user_id FROM users WHERE email = $1)
    `
    await neonHelper.query(query, [email])
    
    return res.status(200).json({ success: true, message: '已取消所有订阅' })
  } catch (error) {
    console.error('[auth] Unsubscribe by email error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
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

