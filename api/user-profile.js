/**
 * 用户扩展资料 API
 * GET/POST /api/user-profile - 获取/更新用户完整资料
 * 包括工作经历、教育背景、技能、简历等
 */

import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { getUserById, saveUser } from '../server-utils/user-storage.js'
import { kv } from '@vercel/kv'
import { createClient } from 'redis'

// Redis配置
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  process.env.pre_haigoo_REDIS_URL ||
  process.env.PRE_HAIGOO_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL
const KV_CONFIGURED = !!(
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
  (process.env.pre_haigoo_KV_REST_API_URL && process.env.pre_haigoo_KV_REST_API_TOKEN)
)
// Upstash REST（优先使用，兼容预发变量命名）
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.pre_haigoo_KV_REST_API_URL || null
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.pre_haigoo_KV_REST_API_TOKEN || null
const UPSTASH_CONFIGURED = !!(UPSTASH_URL && UPSTASH_TOKEN)

let __redisClient = globalThis.__haigoo_redis_client || null

async function getRedisClient() {
  if (!REDIS_CONFIGURED) return null
  if (__redisClient) return __redisClient
  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', err => console.error('[user-profile] Redis error:', err))
    await client.connect()
    __redisClient = client
    globalThis.__haigoo_redis_client = client
    return client
  } catch (error) {
    console.error('[user-profile] Redis connection failed:', error.message)
    return null
  }
}

async function upstashCommand(command, args) {
  if (!UPSTASH_CONFIGURED) return null
  try {
    const resp = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args })
    })
    if (!resp.ok) throw new Error(`Upstash ${command} failed ${resp.status}`)
    const data = await resp.json()
    return data?.result ?? null
  } catch (e) {
    console.error('[user-profile] Upstash REST error:', e.message)
    return null
  }
}

// 内存存储（开发环境备用）
const memoryStore = new Map()

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * 获取用户扩展资料
 */
async function getUserProfile(userId) {
  const key = `haigoo:userprofile:${userId}`
  
  // 优先从 Redis 读取
  if (REDIS_CONFIGURED) {
    try {
      const client = await getRedisClient()
      if (client) {
        const data = await client.get(key)
        if (data) return JSON.parse(data)
      }
    } catch (error) {
      console.error('[user-profile] Redis read error:', error.message)
    }
  }
  
  // 降级到 KV
  if (KV_CONFIGURED) {
    try {
      const data = await kv.get(key)
      if (data) return data
    } catch (error) {
      console.error('[user-profile] KV read error:', error.message)
    }
  }
  
  // 最后从内存读取
  return memoryStore.get(userId) || null
}

/**
 * 保存用户扩展资料
 */
async function saveUserProfile(userId, profileData) {
  const key = `haigoo:userprofile:${userId}`
  const data = {
    ...profileData,
    userId,
    updatedAt: new Date().toISOString()
  }
  
  let saved = false
  
  // 保存到 Redis
  if (REDIS_CONFIGURED) {
    try {
      const client = await getRedisClient()
      if (client) {
        await client.set(key, JSON.stringify(data))
        saved = true
      }
    } catch (error) {
      console.error('[user-profile] Redis write error:', error.message)
    }
  }
  
  // 保存到 KV
  if (KV_CONFIGURED) {
    try {
      await kv.set(key, data)
      saved = true
    } catch (error) {
      console.error('[user-profile] KV write error:', error.message)
    }
  }
  
  // 保存到内存
  memoryStore.set(userId, data)
  
  return saved || true // 至少保存到了内存
}

/**
 * 计算资料完整度
 */
function calculateProfileCompleteness(user, profile) {
  let score = 0
  const weights = {
    basicInfo: 20, // 基础信息（姓名、邮箱、电话）
    professionalInfo: 15, // 职业信息（职位、地点）
    summary: 10, // 个人简介
    experience: 20, // 工作经历
    education: 15, // 教育背景
    skills: 10, // 技能
    resume: 10 // 简历
  }
  
  // 基础信息
  if (user.email) score += weights.basicInfo * 0.5
  if (profile?.phone) score += weights.basicInfo * 0.5
  
  // 职业信息
  if (user.profile?.title) score += weights.professionalInfo * 0.5
  if (user.profile?.location) score += weights.professionalInfo * 0.5
  
  // 个人简介
  if (profile?.summary && profile.summary.length > 20) score += weights.summary
  
  // 工作经历
  if (profile?.experience && profile.experience.length > 0) {
    score += weights.experience
  }
  
  // 教育背景
  if (profile?.education && profile.education.length > 0) {
    score += weights.education
  }
  
  // 技能
  if (profile?.skills && profile.skills.length >= 3) {
    score += weights.skills
  }
  
  // 简历
  if (profile?.resumeFiles && profile.resumeFiles.length > 0) {
    score += weights.resume
  }
  
  return Math.round(score)
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
    // 验证用户身份
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
    // 解析 action（Vercel Node 环境无 req.query 时兼容）
    const rawQuery = req.url && req.url.includes('?') ? req.url.split('?')[1] : ''
    const params = new URLSearchParams(rawQuery)
    const action = params.get('action') || ''

    // 移除收藏相关 action，准备后续重新设计收藏方案
    
    // GET - 获取用户资料
    if (req.method === 'GET') {
      const profile = await getUserProfile(user.id)
      
      // 合并基础用户信息和扩展资料
      const fullProfile = {
        // 基础信息
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        status: user.status,
        
        // profile中的信息
        fullName: user.profile?.fullName || '',
        title: user.profile?.title || '',
        location: user.profile?.location || '',
        targetRole: user.profile?.targetRole || '',
        bio: user.profile?.bio || '',
        
        // 扩展资料
        phone: profile?.phone || '',
        website: profile?.website || '',
        linkedin: profile?.linkedin || '',
        github: profile?.github || '',
        summary: profile?.summary || '',
        
        experience: profile?.experience || [],
        education: profile?.education || [],
        skills: profile?.skills || [],
        resumeFiles: profile?.resumeFiles || [],
        jobApplications: profile?.jobApplications || [],
        savedJobs: profile?.savedJobs || [],
        
        preferences: profile?.preferences || {
          jobAlerts: true,
          emailNotifications: true,
          pushNotifications: false,
          weeklyDigest: true,
          applicationUpdates: true
        },
        
        privacy: profile?.privacy || {
          profileVisible: true,
          contactInfoVisible: false,
          resumeVisible: true,
          allowRecruiterContact: true
        },
        
        profileCompleteness: 0
      }
      
      // 计算资料完整度
      fullProfile.profileCompleteness = calculateProfileCompleteness(user, profile)
      
      return res.status(200).json({
        success: true,
        profile: fullProfile
      })
    }
    
    // POST - 更新用户资料
    if (req.method === 'POST') {
      const updates = req.body
      
      // 验证数据
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, error: '无效的数据格式' })
      }
      
      // 获取现有资料
      const existingProfile = await getUserProfile(user.id) || {}
      
      // 合并更新
      const updatedProfile = {
        ...existingProfile,
        ...updates,
        userId: user.id,
        updatedAt: new Date().toISOString()
      }
      
      // 保存扩展资料
      await saveUserProfile(user.id, updatedProfile)
      
      // 同时更新基础用户信息（如果有）
      if (updates.fullName || updates.title || updates.location || updates.targetRole || updates.bio) {
        if (!user.profile) user.profile = {}
        if (updates.fullName) user.profile.fullName = updates.fullName
        if (updates.title) user.profile.title = updates.title
        if (updates.location) user.profile.location = updates.location
        if (updates.targetRole) user.profile.targetRole = updates.targetRole
        if (updates.bio) user.profile.bio = updates.bio
        user.updatedAt = new Date().toISOString()
        await saveUser(user)
      }
      
      // 计算新的完整度
      const completeness = calculateProfileCompleteness(user, updatedProfile)
      
      console.log(`[user-profile] Profile updated for user ${user.id}, completeness: ${completeness}%`)
      
      return res.status(200).json({
        success: true,
        message: '资料更新成功',
        profileCompleteness: completeness
      })
    }
    
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[user-profile] Error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

