/**
 * 用户数据存储服务
 * 优先使用 Redis，降级到 Vercel KV，最后使用内存
 */

import { kv } from '@vercel/kv'
import { createClient } from 'redis'

// 检测 Redis 配置
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL

// 检测 Vercel KV 配置
const KV_CONFIGURED = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
)

// Redis 客户端缓存
let __redisClient = globalThis.__haigoo_redis_client || null

// 内存存储（开发环境备用）
const memoryStore = {
  users: new Map(), // email -> user
  usersByUserId: new Map() // userId -> user
}

/**
 * 获取或创建 Redis 客户端
 */
async function getRedisClient() {
  if (!REDIS_CONFIGURED) return null
  if (__redisClient) return __redisClient

  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', err => console.error('[user-storage] Redis error:', err))
    await client.connect()
    __redisClient = client
    globalThis.__haigoo_redis_client = client
    console.log('[user-storage] Redis connected successfully')
    return client
  } catch (error) {
    console.error('[user-storage] Failed to connect to Redis:', error.message)
    return null
  }
}

/**
 * 通过邮箱获取用户（Redis）
 */
async function getUserFromRedis(email) {
  try {
    const client = await getRedisClient()
    if (!client) return null
    const userData = await client.get(`haigoo:user:${email}`)
    return userData ? JSON.parse(userData) : null
  } catch (error) {
    console.error('[user-storage] Redis getUserByEmail error:', error.message)
    return null
  }
}

/**
 * 通过用户ID获取用户（Redis）
 */
async function getUserByIdFromRedis(userId) {
  try {
    const client = await getRedisClient()
    if (!client) return null
    // 先获取邮箱映射
    const email = await client.get(`haigoo:userId:${userId}`)
    if (!email) return null
    return await getUserFromRedis(email)
  } catch (error) {
    console.error('[user-storage] Redis getUserById error:', error.message)
    return null
  }
}

/**
 * 保存用户到 Redis
 */
async function saveUserToRedis(user) {
  try {
    const client = await getRedisClient()
    if (!client) return false
    // 保存用户数据（以邮箱为主键）
    await client.set(`haigoo:user:${user.email}`, JSON.stringify(user))
    // 保存 userId -> email 映射，方便通过 userId 查询
    await client.set(`haigoo:userId:${user.id}`, user.email)
    // 维护用户列表集合，便于在无 keys 扫描的存储中获取列表
    try {
      await client.sAdd('haigoo:user_list', user.email)
    } catch (e) {
      console.warn('[user-storage] Redis sAdd user_list failed (non-critical):', e?.message || e)
    }
    console.log(`[user-storage] Saved user to Redis: ${user.email}`)
    return true
  } catch (error) {
    console.error('[user-storage] Redis saveUser error:', error.message)
    return false
  }
}

/**
 * 通过邮箱获取用户（Vercel KV）
 */
async function getUserFromKV(email) {
  try {
    if (!KV_CONFIGURED) return null
    const userData = await kv.get(`haigoo:user:${email}`)
    return userData || null
  } catch (error) {
    console.error('[user-storage] KV getUserByEmail error:', error.message)
    return null
  }
}

/**
 * 通过用户ID获取用户（Vercel KV）
 */
async function getUserByIdFromKV(userId) {
  try {
    if (!KV_CONFIGURED) return null
    const email = await kv.get(`haigoo:userId:${userId}`)
    if (!email) return null
    return await getUserFromKV(email)
  } catch (error) {
    console.error('[user-storage] KV getUserById error:', error.message)
    return null
  }
}

/**
 * 保存用户到 Vercel KV
 */
async function saveUserToKV(user) {
  try {
    if (!KV_CONFIGURED) return false
    await kv.set(`haigoo:user:${user.email}`, user)
    await kv.set(`haigoo:userId:${user.id}`, user.email)
    // 维护用户列表集合，供 /api/users 在 KV 环境读取
    try {
      await kv.sadd('haigoo:user_list', user.email)
    } catch (e) {
      console.warn('[user-storage] KV sadd user_list failed (non-critical):', e?.message || e)
    }
    console.log(`[user-storage] Saved user to KV: ${user.email}`)
    return true
  } catch (error) {
    console.error('[user-storage] KV saveUser error:', error.message)
    return false
  }
}

/**
 * 通过邮箱获取用户（内存）
 */
function getUserFromMemory(email) {
  return memoryStore.users.get(email) || null
}

/**
 * 通过用户ID获取用户（内存）
 */
function getUserByIdFromMemory(userId) {
  return memoryStore.usersByUserId.get(userId) || null
}

/**
 * 保存用户到内存
 */
function saveUserToMemory(user) {
  memoryStore.users.set(user.email, user)
  memoryStore.usersByUserId.set(user.id, user)
  console.log(`[user-storage] Saved user to memory: ${user.email}`)
  return true
}

/**
 * 通过邮箱获取用户（统一入口）
 */
export async function getUserByEmail(email) {
  let user = null
  let provider = 'memory'

  if (REDIS_CONFIGURED) {
    user = await getUserFromRedis(email)
    provider = 'redis'
  } else if (KV_CONFIGURED) {
    user = await getUserFromKV(email)
    provider = 'kv'
  } else {
    user = getUserFromMemory(email)
    provider = 'memory'
  }

  if (user) {
    console.log(`[user-storage] Found user by email (${provider}): ${email}`)
  }
  return user
}

/**
 * 通过用户ID获取用户（统一入口）
 */
export async function getUserById(userId) {
  let user = null
  let provider = 'memory'

  if (REDIS_CONFIGURED) {
    user = await getUserByIdFromRedis(userId)
    provider = 'redis'
  } else if (KV_CONFIGURED) {
    user = await getUserByIdFromKV(userId)
    provider = 'kv'
  } else {
    user = getUserByIdFromMemory(userId)
    provider = 'memory'
  }

  if (user) {
    console.log(`[user-storage] Found user by ID (${provider}): ${userId}`)
  }
  return user
}

/**
 * 保存或更新用户（统一入口）
 */
export async function saveUser(user) {
  let success = false
  let provider = 'memory'

  if (REDIS_CONFIGURED) {
    success = await saveUserToRedis(user)
    provider = 'redis'
  } else if (KV_CONFIGURED) {
    success = await saveUserToKV(user)
    provider = 'kv'
  } else {
    success = saveUserToMemory(user)
    provider = 'memory'
  }

  // 备份到内存（用于快速查询）
  if (success && provider !== 'memory') {
    saveUserToMemory(user)
  }

  console.log(`[user-storage] Save user (${provider}): ${user.email} - ${success ? 'success' : 'failed'}`)
  return { success, provider }
}

export async function deleteUserById(userId) {
  let ok = false
  if (REDIS_CONFIGURED) {
    try {
      const client = await getRedisClient()
      const email = await client.get(`haigoo:userId:${userId}`)
      if (email) {
        await client.del(`haigoo:user:${email}`)
        await client.del(`haigoo:userId:${userId}`)
        try { await client.sRem('haigoo:user_list', email) } catch {}
        memoryStore.users.delete(email)
        memoryStore.usersByUserId.delete(userId)
        ok = true
      }
    } catch (e) {
      ok = false
    }
  } else if (KV_CONFIGURED) {
    try {
      const email = await kv.get(`haigoo:userId:${userId}`)
      if (email) {
        await kv.del(`haigoo:user:${email}`)
        await kv.del(`haigoo:userId:${userId}`)
        try { await kv.srem('haigoo:user_list', email) } catch {}
        memoryStore.users.delete(email)
        memoryStore.usersByUserId.delete(userId)
        ok = true
      }
    } catch (e) {
      ok = false
    }
  } else {
    const email = memoryStore.usersByUserId.get(userId)?.email
    if (email) {
      memoryStore.users.delete(email)
      memoryStore.usersByUserId.delete(userId)
      ok = true
    }
  }
  return ok
}

/**
 * 检查邮箱是否已被注册
 */
export async function isEmailTaken(email) {
  const user = await getUserByEmail(email)
  return !!user
}

/**
 * 获取存储提供者信息
 */
export function getStorageProviderInfo() {
  return {
    redis: REDIS_CONFIGURED,
    kv: KV_CONFIGURED,
    primary: REDIS_CONFIGURED ? 'redis' : KV_CONFIGURED ? 'kv' : 'memory'
  }
}

