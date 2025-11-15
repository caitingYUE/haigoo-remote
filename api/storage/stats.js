// 安全加载 Vercel KV：避免顶层导入在本地环境报错
let kv = null
try {
  const kvModule = require('@vercel/kv')
  kv = kvModule?.kv || null
} catch (e) {
  console.warn('[storage-stats] Vercel KV module not available, will use fallbacks')
}

// 统一环境变量解析，兼容预发命名（pre_haigoo_*、pre_*、haigoo_*）
function getEnv(...names) {
  const variants = (name) => [
    name,
    `haigoo_${name}`,
    `HAIGOO_${name}`,
    `pre_${name}`,
    `PRE_${name}`,
    `pre_haigoo_${name}`,
    `PRE_HAIGOO_${name}`
  ]
  for (const base of names) {
    for (const key of variants(base)) {
      if (process.env[key]) return process.env[key]
    }
  }
  return null
}

const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'
const KV_REST_API_URL = getEnv('KV_REST_API_URL')
const KV_REST_API_TOKEN = getEnv('KV_REST_API_TOKEN')
if (KV_REST_API_URL && !process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = KV_REST_API_URL
if (KV_REST_API_TOKEN && !process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = KV_REST_API_TOKEN
const KV_CONFIGURED = Boolean(KV_REST_API_URL) && Boolean(KV_REST_API_TOKEN)

// Detect Upstash Redis REST configuration
const UPSTASH_REST_URL = getEnv('UPSTASH_REDIS_REST_URL', 'UPSTASH_REST_URL', 'REDIS_REST_API_URL')
const UPSTASH_REST_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REST_TOKEN', 'REDIS_REST_API_TOKEN')
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN)

// Detect Redis configuration
const REDIS_URL = getEnv('REDIS_URL', 'UPSTASH_REDIS_URL') ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
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

async function upstashGet(key) {
  if (!UPSTASH_REST_CONFIGURED) throw new Error('Upstash REST not configured')
  try {
    const res = await fetch(`${UPSTASH_REST_URL}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${UPSTASH_REST_TOKEN}` }
    })
    if (res.ok) {
      const json = await res.json().catch(() => null)
      if (json && typeof json.result !== 'undefined') return json.result
    }
  } catch {}
  const res2 = await fetch(`${UPSTASH_REST_URL}/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: JSON.stringify({ key })
  })
  const json2 = await res2.json().catch(() => null)
  return json2?.result ?? null
}

async function readStatsFromUpstashREST() {
  const statsStr = await upstashGet(STATS_KEY)
  const lastSyncStr = await upstashGet(LAST_SYNC_KEY)
  if (statsStr) {
    try {
      const stats = typeof statsStr === 'string' ? JSON.parse(statsStr) : statsStr
      return {
        totalJobs: stats.totalJobs || 0,
        storageSize: stats.storageSize || 0,
        lastSync: lastSyncStr || null
      }
    } catch (e) {
      console.warn('[storage-stats] Upstash REST stats parse error:', e?.message || e)
    }
  }
  const jobsStr = await upstashGet(JOBS_KEY)
  if (jobsStr) {
    try {
      const jobs = typeof jobsStr === 'string' ? JSON.parse(jobsStr) : jobsStr
      const arr = Array.isArray(jobs) ? jobs : []
      return {
        totalJobs: arr.length,
        storageSize: JSON.stringify(arr).length,
        lastSync: lastSyncStr || null
      }
    } catch (e) {
      console.warn('[storage-stats] Upstash REST jobs parse error:', e?.message || e)
    }
  }
  return { totalJobs: 0, storageSize: 0, lastSync: null }
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
    
    // 统一策略：优先 Upstash REST -> 其次 Redis -> 其次 KV -> 最后内存
    if (UPSTASH_REST_CONFIGURED) {
      try {
        const stats = await readStatsFromUpstashREST()
        provider = 'upstash-rest'
        jobsCount = stats.totalJobs
        storageSize = stats.storageSize
        lastSync = stats.lastSync
        console.log(`[storage-stats] Upstash REST read success: ${jobsCount} jobs, ${storageSize} bytes`)
      } catch (e) {
        console.warn(`[storage-stats] Upstash REST read failed, fallback to Redis:`, e?.message || e)
        if (REDIS_CONFIGURED) {
          try {
            const stats = await readStatsFromRedis()
            provider = 'redis'
            jobsCount = stats.totalJobs
            storageSize = stats.storageSize
            lastSync = stats.lastSync
            console.log(`[storage-stats] Redis read success: ${jobsCount} jobs, ${storageSize} bytes`)
          } catch (er) {
            console.warn(`[storage-stats] Redis read failed, fallback to KV:`, er?.message || er)
            if (KV_CONFIGURED && kv) {
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
              } catch (err2) {
                console.warn(`[storage-stats] KV read failed:`, err2?.message || err2)
                provider = 'memory'
              }
            } else {
              provider = 'memory'
            }
          }
        } else if (KV_CONFIGURED && kv) {
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
          } catch (err3) {
            console.warn(`[storage-stats] KV read failed:`, err3?.message || err3)
            provider = 'memory'
          }
        } else {
          provider = 'memory'
        }
      }
    } else if (REDIS_CONFIGURED) {
      try {
        const stats = await readStatsFromRedis()
        provider = 'redis'
        jobsCount = stats.totalJobs
        storageSize = stats.storageSize
        lastSync = stats.lastSync
        console.log(`[storage-stats] Redis read success: ${jobsCount} jobs, ${storageSize} bytes`)
      } catch (e) {
        console.warn(`[storage-stats] Redis read failed, fallback to KV:`, e?.message || e)
        if (KV_CONFIGURED && kv) {
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
    } else if (KV_CONFIGURED && kv) {
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
    res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
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
    res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
    return res.status(500).json({ error: 'Failed to fetch storage stats', message: error?.message || String(error) })
  }
}