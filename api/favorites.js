import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { kv } from '@vercel/kv'
import { createClient } from 'redis'

const REDIS_URL = process.env.REDIS_URL || process.env.haigoo_REDIS_URL || process.env.HAIGOO_REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.pre_haigoo_REDIS_URL || process.env.PRE_HAIGOO_REDIS_URL || null
const KV_CONFIGURED = !!((process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) || (process.env.pre_haigoo_KV_REST_API_URL && process.env.pre_haigoo_KV_REST_API_TOKEN))
const REDIS_CONFIGURED = !!REDIS_URL

let __redisClient = globalThis.__haigoo_fav_redis || null

async function getRedisClient() {
  if (!REDIS_CONFIGURED) return null
  if (__redisClient) return __redisClient
  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', err => console.error('[favorites] Redis error:', err))
    await client.connect()
    __redisClient = client
    globalThis.__haigoo_fav_redis = client
    return client
  } catch (e) {
    console.error('[favorites] Redis connect failed:', e?.message || e)
    return null
  }
}

const memoryStore = new Map() // userId -> Set(jobId)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function readFavorites(userId) {
  const key = `haigoo:favorites:${userId}`
  // Redis
  try {
    const r = await getRedisClient()
    if (r) {
      const ids = await r.sMembers(key)
      if (ids) return ids
    }
  } catch (e) {
    console.warn('[favorites] Redis read failed:', e?.message || e)
  }
  // KV
  if (KV_CONFIGURED) {
    try {
      const ids = await kv.smembers(key)
      if (ids) return ids
    } catch (e) {
      console.warn('[favorites] KV read failed:', e?.message || e)
    }
  }
  // Memory
  return Array.from(memoryStore.get(userId) || new Set())
}

async function addFavorite(userId, jobId) {
  if (!jobId) return false
  const key = `haigoo:favorites:${userId}`
  try {
    const r = await getRedisClient()
    if (r) { await r.sAdd(key, jobId); return true }
  } catch {}
  if (KV_CONFIGURED) {
    try { await kv.sadd(key, jobId); return true } catch {}
  }
  const set = memoryStore.get(userId) || new Set(); set.add(jobId); memoryStore.set(userId, set); return true
}

async function removeFavorite(userId, jobId) {
  if (!jobId) return false
  const key = `haigoo:favorites:${userId}`
  try { const r = await getRedisClient(); if (r) { await r.sRem(key, jobId); } } catch {}
  if (KV_CONFIGURED) { try { await kv.srem(key, jobId) } catch {} }
  const set = memoryStore.get(userId) || new Set(); set.delete(jobId); memoryStore.set(userId, set); return true
}

async function fetchProcessedJobs(origin) {
  try {
    const url = `${origin}/api/data/processed-jobs?page=1&limit=1000`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`fetch processed-jobs failed: ${resp.status}`)
    const data = await resp.json()
    // API 可能返回 { jobs: [] } 或数组，做兼容
    return Array.isArray(data) ? data : (data.jobs || [])
  } catch (e) {
    console.warn('[favorites] fetch processed-jobs error:', e?.message || e)
    return []
  }
}

function computeStatus(job) {
  if (!job) return '已下架'
  if (job.expiresAt) {
    const exp = new Date(job.expiresAt).getTime()
    if (!Number.isNaN(exp) && exp < Date.now()) return '已失效'
  }
  return '有效中'
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  try {
    const token = extractToken(req)
    if (!token) return res.status(401).json({ success: false, error: '未提供认证令牌' })
    const payload = verifyToken(token)
    if (!payload?.userId) return res.status(401).json({ success: false, error: '认证令牌无效或已过期' })
    const userId = payload.userId

    if (req.method === 'GET') {
      const favIds = await readFavorites(userId)
      const origin = (req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] : 'https') + '://' + (req.headers.host || process.env.VERCEL_URL || '')
      const jobs = await fetchProcessedJobs(origin)
      const map = new Map(jobs.map(j => [j.id, j]))
      const items = favIds.map(id => {
        const job = map.get(id)
        const status = computeStatus(job)
        return {
          jobId: id,
          status,
          title: job?.title || '',
          company: job?.company || '',
          postedAt: job?.postedAt || '',
          expiresAt: job?.expiresAt || null,
          type: job?.type || '',
          isRemote: !!job?.isRemote,
          salary: job?.salary || null
        }
      })
      return res.status(200).json({ success: true, favorites: items })
    }

    if (req.method === 'POST') {
      const { jobId } = req.body || {}
      if (!jobId) return res.status(400).json({ success: false, error: '缺少 jobId' })
      await addFavorite(userId, jobId)
      return res.status(200).json({ success: true, message: '收藏成功' })
    }

    if (req.method === 'DELETE') {
      const { jobId } = req.body || {}
      if (!jobId) return res.status(400).json({ success: false, error: '缺少 jobId' })
      await removeFavorite(userId, jobId)
      return res.status(200).json({ success: true, message: '取消收藏成功' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('[favorites] Error:', e)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
}