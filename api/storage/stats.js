import { kv } from '@vercel/kv'

const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'
const KV_CONFIGURED = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN)

// Detect Redis configuration
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL
let __redisClient = globalThis.__haigoo_redis_client || null

async function getRedisClient() {
  if (!REDIS_CONFIGURED) throw new Error('Redis not configured')
  if (__redisClient) return __redisClient
  const { createClient } = await import('redis')
  const client = createClient({ url: REDIS_URL })
  client.on('error', (err) => console.warn('[storage-stats] Redis client error:', err?.message || err))
  await client.connect()
  __redisClient = client
  globalThis.__haigoo_redis_client = client
  return client
}

async function readStatsFromRedis() {
  const client = await getRedisClient()
  const statsStr = await client.get(STATS_KEY)
  const lastSyncStr = await client.get(LAST_SYNC_KEY)
  
  if (statsStr) {
    try {
      const stats = JSON.parse(statsStr)
      return {
        totalJobs: stats.totalJobs || 0,
        storageSize: stats.storageSize || 0,
        lastSync: lastSyncStr || null
      }
    } catch (e) {
      console.warn('[storage-stats] Redis stats parse error:', e?.message || e)
    }
  }
  
  // Fallback: count jobs directly
  const jobsStr = await client.get(JOBS_KEY)
  if (jobsStr) {
    try {
      const jobs = JSON.parse(jobsStr)
      const arr = Array.isArray(jobs) ? jobs : []
      return {
        totalJobs: arr.length,
        storageSize: JSON.stringify(arr).length,
        lastSync: lastSyncStr || null
      }
    } catch (e) {
      console.warn('[storage-stats] Redis jobs parse error:', e?.message || e)
    }
  }
  
  return { totalJobs: 0, storageSize: 0, lastSync: null }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let provider = 'memory'
    let jobsCount = 0
    let storageSize = 0
    let lastSync = null
    
    // 统一策略：优先 Redis -> 其次 KV -> 最后内存
    if (REDIS_CONFIGURED) {
      try {
        const stats = await readStatsFromRedis()
        provider = 'redis'
        jobsCount = stats.totalJobs
        storageSize = stats.storageSize
        lastSync = stats.lastSync
        console.log(`[storage-stats] Redis read success: ${jobsCount} jobs, ${storageSize} bytes`)
      } catch (e) {
        console.warn(`[storage-stats] Redis read failed, fallback to KV:`, e?.message || e)
        if (KV_CONFIGURED) {
          try {
            const stats = await kv.get(STATS_KEY)
            lastSync = await kv.get(LAST_SYNC_KEY)
            if (!stats) {
              const jobs = await kv.get(JOBS_KEY)
              const arr = Array.isArray(jobs) ? jobs : (typeof jobs === 'string' ? JSON.parse(jobs) : [])
              jobsCount = Array.isArray(arr) ? arr.length : 0
              storageSize = JSON.stringify(arr).length
            } else {
              jobsCount = stats.totalJobs || 0
              storageSize = stats.storageSize || 0
            }
            provider = 'vercel-kv'
            console.log(`[storage-stats] KV read success: ${jobsCount} jobs, ${storageSize} bytes`)
          } catch (er) {
            console.warn(`[storage-stats] KV read failed:`, er?.message || er)
            provider = 'memory'
          }
        } else {
          provider = 'memory'
        }
      }
    } else if (KV_CONFIGURED) {
      try {
        const stats = await kv.get(STATS_KEY)
        lastSync = await kv.get(LAST_SYNC_KEY)
        if (!stats) {
          const jobs = await kv.get(JOBS_KEY)
          const arr = Array.isArray(jobs) ? jobs : (typeof jobs === 'string' ? JSON.parse(jobs) : [])
          jobsCount = Array.isArray(arr) ? arr.length : 0
          storageSize = JSON.stringify(arr).length
        } else {
          jobsCount = stats.totalJobs || 0
          storageSize = stats.storageSize || 0
        }
        provider = 'vercel-kv'
        console.log(`[storage-stats] KV read success: ${jobsCount} jobs, ${storageSize} bytes`)
      } catch (e) {
        console.warn(`[storage-stats] KV read failed:`, e?.message || e)
        provider = 'memory'
      }
    } else {
      provider = 'memory'
    }

    res.setHeader('X-Storage-Provider', provider)
    res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
    res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
    return res.status(200).json({
      provider,
      totalJobs: jobsCount,
      storageSize,
      lastSync
    })
  } catch (error) {
    console.error('[storage-stats] API error:', error)
    res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
    res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
    return res.status(500).json({ error: 'Failed to fetch storage stats', message: error?.message || String(error) })
  }
}