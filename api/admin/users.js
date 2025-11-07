/**
 * 管理后台 - 用户管理 API
 * GET /api/admin/users - 获取所有用户列表
 * GET /api/admin/users?id=xxx - 获取特定用户详情
 */

import { kv } from '@vercel/kv'
import { createClient } from 'redis'

// Redis配置
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL
const KV_CONFIGURED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

let __redisClient = globalThis.__haigoo_redis_client || null

async function getRedisClient() {
  if (!REDIS_CONFIGURED) return null
  if (__redisClient) return __redisClient
  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', err => console.error('[admin/users] Redis error:', err))
    await client.connect()
    __redisClient = client
    globalThis.__haigoo_redis_client = client
    return client
  } catch (error) {
    console.error('[admin/users] Redis connection failed:', error.message)
    return null
  }
}

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * 从 Redis 获取所有用户
 */
async function getAllUsersFromRedis() {
  try {
    const client = await getRedisClient()
    if (!client) return null
    
    // 获取所有用户key
    const keys = await client.keys('haigoo:user:*')
    if (!keys || keys.length === 0) return []
    
    const users = []
    for (const key of keys) {
      try {
        const userData = await client.get(key)
        if (userData) {
          users.push(JSON.parse(userData))
        }
      } catch (error) {
        console.error(`[admin/users] Error parsing user data for key ${key}:`, error.message)
      }
    }
    
    return users
  } catch (error) {
    console.error('[admin/users] Redis getAllUsers error:', error.message)
    return null
  }
}

/**
 * 从 KV 获取所有用户
 */
async function getAllUsersFromKV() {
  try {
    if (!KV_CONFIGURED) return null
    
    // Vercel KV 不支持 keys 命令，需要维护一个用户列表
    // 这里先返回空数组，实际使用时需要在注册时维护一个用户列表
    const userList = await kv.get('haigoo:user_list') || []
    
    const users = []
    for (const email of userList) {
      try {
        const userData = await kv.get(`haigoo:user:${email}`)
        if (userData) {
          users.push(userData)
        }
      } catch (error) {
        console.error(`[admin/users] Error fetching user ${email}:`, error.message)
      }
    }
    
    return users
  } catch (error) {
    console.error('[admin/users] KV getAllUsers error:', error.message)
    return null
  }
}

/**
 * 获取用户的扩展资料
 */
async function getUserProfile(userId) {
  const key = `haigoo:userprofile:${userId}`
  
  if (REDIS_CONFIGURED) {
    try {
      const client = await getRedisClient()
      if (client) {
        const data = await client.get(key)
        if (data) return JSON.parse(data)
      }
    } catch (error) {
      console.error('[admin/users] Redis profile read error:', error.message)
    }
  }
  
  if (KV_CONFIGURED) {
    try {
      const data = await kv.get(key)
      if (data) return data
    } catch (error) {
      console.error('[admin/users] KV profile read error:', error.message)
    }
  }
  
  return null
}

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  
  try {
    const { id } = req.query
    
    // 获取特定用户详情
    if (id) {
      // TODO: 实现用户详情查询
      // 需要根据userId获取用户基础信息和扩展资料
      return res.status(501).json({
        success: false,
        error: '用户详情功能待实现'
      })
    }
    
    // 获取所有用户列表
    let users = null
    let provider = 'none'
    
    if (REDIS_CONFIGURED) {
      users = await getAllUsersFromRedis()
      provider = 'redis'
    } else if (KV_CONFIGURED) {
      users = await getAllUsersFromKV()
      provider = 'kv'
    }
    
    if (!users) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        provider: 'none',
        message: '无存储配置或无用户数据'
      })
    }
    
    // 获取每个用户的扩展资料以计算完整度
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const profile = await getUserProfile(user.id)
      
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        status: user.status,
        
        // 统计信息
        profileCompleteness: calculateProfileCompleteness(user, profile),
        applicationCount: profile?.jobApplications?.length || 0,
        resumeCount: profile?.resumeFiles?.length || 0,
        
        // 职业信息
        title: user.profile?.title || '',
        location: user.profile?.location || ''
      }
    }))
    
    // 按创建时间倒序排序
    usersWithStats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    console.log(`[admin/users] Retrieved ${usersWithStats.length} users from ${provider}`)
    
    return res.status(200).json({
      success: true,
      users: usersWithStats,
      total: usersWithStats.length,
      provider
    })
  } catch (error) {
    console.error('[admin/users] Error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}

/**
 * 计算资料完整度（复用逻辑）
 */
function calculateProfileCompleteness(user, profile) {
  let score = 0
  const weights = {
    basicInfo: 20,
    professionalInfo: 15,
    summary: 10,
    experience: 20,
    education: 15,
    skills: 10,
    resume: 10
  }
  
  if (user.email) score += weights.basicInfo * 0.5
  if (profile?.phone) score += weights.basicInfo * 0.5
  
  if (user.profile?.title) score += weights.professionalInfo * 0.5
  if (user.profile?.location) score += weights.professionalInfo * 0.5
  
  if (profile?.summary && profile.summary.length > 20) score += weights.summary
  
  if (profile?.experience && profile.experience.length > 0) score += weights.experience
  if (profile?.education && profile.education.length > 0) score += weights.education
  if (profile?.skills && profile.skills.length >= 3) score += weights.skills
  if (profile?.resumeFiles && profile.resumeFiles.length > 0) score += weights.resume
  
  return Math.round(score)
}

