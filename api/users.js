/**
 * 用户管理 API
 * GET /api/users - 获取用户列表（管理员）
 * GET /api/users?id=xxx - 获取特定用户详情
 */

import { kv } from '@vercel/kv'
import { createClient } from 'redis'
import { getUserById, saveUser, deleteUserById } from '../server-utils/user-storage.js'
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js'

// Redis配置检测
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL

// Vercel KV配置检测
const KV_CONFIGURED = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
)

// Redis客户端缓存
let __redisClient = globalThis.__haigoo_redis_client || null

// 内存存储（开发环境备用）
const memoryStore = {
  users: new Map() // email -> user
}

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * 获取或创建 Redis 客户端
 */
async function getRedisClient() {
  if (!REDIS_CONFIGURED) return null
  if (__redisClient) return __redisClient

  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', err => console.error('[users] Redis error:', err))
    await client.connect()
    __redisClient = client
    globalThis.__haigoo_redis_client = client
    console.log('[users] Redis connected')
    return client
  } catch (error) {
    console.error('[users] Failed to connect to Redis:', error.message)
    return null
  }
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
    if (keys.length === 0) return []

    // 批量获取用户数据
    const users = []
    for (const key of keys) {
      const userData = await client.get(key)
      if (userData) {
        const user = JSON.parse(userData)
        // 获取收藏数量和ID
        try {
          const favoritesKey = `haigoo:favorites:${user.id}`
          const ids = await client.sMembers(favoritesKey)
          user.favorites = ids || []
          user.favoritesCount = ids ? ids.length : 0
        } catch (e) {
          user.favorites = []
          user.favoritesCount = 0
        }
        users.push(user)
      }
    }

    return users
  } catch (error) {
    console.error('[users] Redis getAllUsers error:', error.message)
    return null
  }
}

/**
 * 从 Vercel KV 获取所有用户
 */
async function getAllUsersFromKV() {
  try {
    if (!KV_CONFIGURED) return null

    // KV doesn't support KEYS pattern, 需要维护用户列表
    // 临时方案：扫描已知的用户
    const userListKey = 'haigoo:user_list'
    const userEmails = await kv.smembers(userListKey)

    if (!userEmails || userEmails.length === 0) return []

    const users = []
    for (const email of userEmails) {
      const user = await kv.get(`haigoo:user:${email}`)
      if (user) {
        // 获取收藏数量和ID
        try {
          const favoritesKey = `haigoo:favorites:${user.id}`
          const ids = await kv.smembers(favoritesKey)
          user.favorites = ids || []
          user.favoritesCount = ids ? ids.length : 0
        } catch (e) {
          user.favorites = []
          user.favoritesCount = 0
        }
        users.push(user)
      }
    }

    return users
  } catch (error) {
    console.error('[users] KV getAllUsers error:', error.message)
    return null
  }
}

/**
 * 从内存获取所有用户
 */
function getAllUsersFromMemory() {
  return Array.from(memoryStore.users.values())
}

/**
 * 清理用户敏感信息
 */
function sanitizeUser(user) {
  const { passwordHash, verificationToken, ...safeUser } = user
  return safeUser
}

const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'

/**
 * 主处理器
 */
export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const requester = payload?.userId ? await getUserById(payload.userId) : null
  const isAdmin = !!(requester?.roles?.admin || requester?.email === 'caitlinyct@gmail.com')
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status, username, roles } = req.body || {}
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }

      const user = await getUserById(id)
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      if (status && ['active', 'suspended'].includes(status)) {
        user.status = status
      }
      if (typeof username === 'string' && username.trim()) {
        user.username = username.trim()
      }
      if (roles && typeof roles === 'object') {
        // 超级管理员不可更改权限
        if (user.email === SUPER_ADMIN_EMAIL) {
          user.roles = { ...(user.roles || {}), admin: true }
        } else {
          user.roles = { ...(user.roles || {}), ...roles }
        }
      }
      user.updatedAt = new Date().toISOString()

      const { success } = await saveUser(user)
      if (!success) {
        return res.status(500).json({ success: false, error: '更新失败，请稍后重试' })
      }

      return res.status(200).json({ success: true, user: sanitizeUser(user) })
    } catch (error) {
      console.error('[users] PATCH error:', error)
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query
      if (!id) {
        return res.status(400).json({ success: false, error: '缺少用户ID' })
      }
      const target = await getUserById(String(id))
      if (target?.email === SUPER_ADMIN_EMAIL) {
        return res.status(400).json({ success: false, error: '不可删除超级管理员' })
      }
      const ok = await deleteUserById(String(id))
      return res.status(ok ? 200 : 500).json({ success: !!ok })
    } catch (e) {
      return res.status(500).json({ success: false, error: '服务器错误' })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    // 如果提供了 id，返回特定用户
    if (id) {
      // 通过 id 查找用户需要遍历所有用户
      let users = []
      let provider = 'memory'

      if (REDIS_CONFIGURED) {
        users = await getAllUsersFromRedis()
        provider = 'redis'
      } else if (KV_CONFIGURED) {
        users = await getAllUsersFromKV()
        provider = 'kv'
      } else {
        users = getAllUsersFromMemory()
        provider = 'memory'
      }

      const user = users?.find(u => u.id === id)
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      return res.status(200).json({
        success: true,
        user: sanitizeUser(user),
        provider
      })
    }

    // 获取所有用户列表
    let users = []
    let provider = 'memory'

    if (REDIS_CONFIGURED) {
      users = await getAllUsersFromRedis()
      provider = 'redis'
    } else if (KV_CONFIGURED) {
      users = await getAllUsersFromKV()
      provider = 'kv'
    } else {
      users = getAllUsersFromMemory()
      provider = 'memory'
    }

    if (!users) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch users'
      })
    }

    // 清理敏感信息
    const safeUsers = users.map(sanitizeUser)

    // 按创建时间倒序排列（最新的在前）
    safeUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    console.log(`[users] Fetched ${safeUsers.length} users from ${provider}`)

    return res.status(200).json({
      success: true,
      users: safeUsers,
      total: safeUsers.length,
      provider
    })
  } catch (error) {
    console.error('[users] Error:', error)
    return res.status(500).json({
      success: false,
      error: '服务器错误'
    })
  }
}

