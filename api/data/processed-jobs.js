import { kv } from '@vercel/kv'

// Detect KV configuration (REST-only). Avoid misinterpreting KV_URL without REST creds.
const KV_CONFIGURED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

// Detect Redis configuration (accept multiple env var names)
// Prefer standard REDIS_URL, but also support project-specific or provider-specific names
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL
let __redisClient = globalThis.__haigoo_redis_client || null
if (!globalThis.__haigoo_processed_jobs_mem) {
  globalThis.__haigoo_processed_jobs_mem = []
}
const MEM = globalThis.__haigoo_processed_jobs_mem

// Keys used in KV
const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'

// Helpers: recent filter and duplicate removal (keep last 7 days, dedupe by title+company+location)
function filterRecentJobs(jobs, maxDays = 7) {
  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)
  return jobs.filter(j => new Date(j.publishedAt) >= cutoff)
}

function removeDuplicates(jobs) {
  const seen = new Set()
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.location || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function applyFilters(jobs, q) {
  let list = jobs
  if (q.source) list = list.filter(j => j.source === q.source)
  if (q.category) list = list.filter(j => j.category === q.category)
  if (q.status) list = list.filter(j => j.status === q.status)
  if (q.company) list = list.filter(j => (j.company || '').toLowerCase().includes(String(q.company).toLowerCase()))
  if (typeof q.isRemote !== 'undefined') list = list.filter(j => !!j.isRemote === (q.isRemote === true || q.isRemote === 'true'))
  if (q.location) list = list.filter(j => (j.location || '').toLowerCase().includes(String(q.location).toLowerCase()))
  if (q.type) list = list.filter(j => (j.jobType || j.type) === q.type)
  if (q.search) {
    const s = String(q.search).toLowerCase()
    list = list.filter(j => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(s))
  }
  if (q.dateFrom || q.dateTo) {
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? new Date(q.dateTo) : null
    list = list.filter(j => {
      const d = new Date(j.publishedAt)
      return (!from || d >= from) && (!to || d <= to)
    })
  }
  if (Array.isArray(q.tags) && q.tags.length > 0) {
    const tagsLower = q.tags.map(t => String(t).toLowerCase())
    list = list.filter(j => Array.isArray(j.tags) && j.tags.some(t => tagsLower.includes(String(t).toLowerCase())))
  }
  if (Array.isArray(q.skills) && q.skills.length > 0) {
    const skillsLower = q.skills.map(t => String(t).toLowerCase())
    list = list.filter(j => Array.isArray(j.tags) && j.tags.some(t => skillsLower.includes(String(t).toLowerCase())))
  }
  // Sort by publishedAt desc (guard against invalid dates/NaN)
  const safeGetTime = (val) => {
    const t = new Date(val).getTime()
    return Number.isFinite(t) ? t : 0
  }
  return list.sort((a, b) => safeGetTime(b.publishedAt) - safeGetTime(a.publishedAt))
}

function paginate(jobs, pageNum, pageSize) {
  const total = jobs.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (pageNum - 1) * pageSize
  const end = start + pageSize
  const items = jobs.slice(start, end)
  return { items, total, totalPages }
}

async function readJobsFromKV() {
  const data = await kv.get(JOBS_KEY)
  if (!data) return []
  const jobs = Array.isArray(data) ? data : JSON.parse(typeof data === 'string' ? data : '[]')
  return jobs
}

async function getRedisClient() {
  if (!REDIS_CONFIGURED) throw new Error('Redis not configured')
  if (__redisClient) return __redisClient
  const { createClient } = await import('redis')
  const client = createClient({ url: REDIS_URL })
  client.on('error', (err) => console.warn('Redis client error:', err?.message || err))
  await client.connect()
  __redisClient = client
  globalThis.__haigoo_redis_client = client
  return client
}

async function readJobsFromRedis() {
  const client = await getRedisClient()
  const data = await client.get(JOBS_KEY)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('Redis get parse error:', e?.message || e)
    return []
  }
}

function readJobsFromMemory() {
  return Array.isArray(MEM) ? MEM : []
}

function writeJobsToMemory(jobs) {
  MEM.length = 0
  MEM.push(...jobs)
  return MEM
}

async function writeJobsToKV(jobs) {
  const recent = filterRecentJobs(jobs)
  const unique = removeDuplicates(recent)
  await kv.set(JOBS_KEY, unique)
  await kv.set(LAST_SYNC_KEY, new Date().toISOString())
  await kv.set(STATS_KEY, {
    totalJobs: unique.length,
    storageSize: JSON.stringify(unique).length,
    lastSync: new Date().toISOString(),
    provider: 'vercel-kv'
  })
  return unique
}

async function writeJobsToRedis(jobs) {
  const recent = filterRecentJobs(jobs)
  const unique = removeDuplicates(recent)
  const client = await getRedisClient()
  await client.set(JOBS_KEY, JSON.stringify(unique))
  await client.set(LAST_SYNC_KEY, new Date().toISOString())
  await client.set(STATS_KEY, JSON.stringify({
    totalJobs: unique.length,
    storageSize: JSON.stringify(unique).length,
    lastSync: new Date().toISOString(),
    provider: 'redis'
  }))
  return unique
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      const {
        page = '1',
        limit = '20',
        source,
        category,
        status,
        dateFrom,
        dateTo,
        company,
        isRemote,
        search,
        location,
        type,
        tags,
        skills
      } = req.query || {}

      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 20

      let jobs = []
      let provider = 'memory'
      // 优先 KV -> 其次 Redis -> 最后内存
      if (KV_CONFIGURED) {
        try {
          jobs = await readJobsFromKV()
          provider = 'vercel-kv'
        } catch (e) {
          console.warn('KV 读取失败，尝试 Redis 回退:', e?.message || e)
          if (REDIS_CONFIGURED) {
            try {
              jobs = await readJobsFromRedis()
              provider = 'redis'
            } catch (er) {
              console.warn('Redis 读取失败，使用内存回退:', er?.message || er)
              jobs = readJobsFromMemory()
              provider = 'memory'
            }
          } else {
            jobs = readJobsFromMemory()
            provider = 'memory'
          }
        }
      } else if (REDIS_CONFIGURED) {
        try {
          jobs = await readJobsFromRedis()
          provider = 'redis'
        } catch (e) {
          console.warn('Redis 读取失败，使用内存回退:', e?.message || e)
          jobs = readJobsFromMemory()
          provider = 'memory'
        }
      } else {
        jobs = readJobsFromMemory()
        provider = 'memory'
      }
      let filtered = []
      try {
        filtered = applyFilters(jobs, {
          source,
          category,
          status,
          dateFrom,
          dateTo,
          company,
          isRemote,
          search,
          location,
          type,
          tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []),
          skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? [skills] : [])
        })
      } catch (e) {
        console.warn('过滤处理异常，返回未过滤数据：', e?.message || e)
        filtered = Array.isArray(jobs) ? jobs : []
      }

      let items = []
      let total = 0
      let totalPages = 0
      try {
        const paged = paginate(filtered, pageNum, pageSize)
        items = Array.isArray(paged.items) ? paged.items : []
        total = Number.isFinite(paged.total) ? paged.total : 0
        totalPages = Number.isFinite(paged.totalPages) ? paged.totalPages : 0
      } catch (e) {
        console.warn('分页处理异常，返回空集：', e?.message || e)
        items = []
        total = 0
        totalPages = 0
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      try { res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED)) } catch {}
      return res.status(200).json({
        jobs: items,
        total,
        page: pageNum,
        pageSize,
        totalPages
      })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (!body || typeof body !== 'object') {
        // Raw body fallback
        body = await new Promise((resolve) => {
          let data = ''
          req.on('data', chunk => data += chunk)
          req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
          })
        })
      }

      const { jobs = [], mode: bodyMode } = body || {}
      const mode = (bodyMode || req.query?.mode || 'replace').toString()
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ error: 'jobs must be an array' })
      }

      // Normalize minimal required fields
      const normalized = jobs.map(j => ({
        id: j.id || `${(j.title || 'job')}-${(j.company || 'unknown')}-${(j.url || Math.random().toString(36).slice(2))}`,
        title: j.title,
        company: j.company || 'Unknown Company',
        location: j.location || 'Remote',
        description: j.description || '',
        url: j.url,
        publishedAt: j.publishedAt || new Date().toISOString(),
        source: j.source || 'unknown',
        category: j.category || '其他',
        salary: j.salary || null,
        jobType: j.jobType || 'full-time',
        experienceLevel: j.experienceLevel || 'Mid',
        tags: Array.isArray(j.tags) ? j.tags : [],
        requirements: Array.isArray(j.requirements) ? j.requirements : [],
        benefits: Array.isArray(j.benefits) ? j.benefits : [],
        isRemote: typeof j.isRemote === 'boolean' ? j.isRemote : true,
        status: j.status || 'active',
        createdAt: j.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))

      let toWrite = normalized
      let provider = 'memory'
      if (mode === 'append') {
        if (KV_CONFIGURED) {
          try {
            const existing = await readJobsFromKV()
            toWrite = [...existing, ...normalized]
            provider = 'vercel-kv'
          } catch (e) {
            console.warn('KV 读取失败（append），尝试 Redis 回退:', e?.message || e)
            if (REDIS_CONFIGURED) {
              try {
                const existing = await readJobsFromRedis()
                toWrite = [...existing, ...normalized]
                provider = 'redis'
              } catch (er) {
                console.warn('Redis 读取失败（append），改用内存回退:', er?.message || er)
                const existing = readJobsFromMemory()
                toWrite = [...existing, ...normalized]
                provider = 'memory'
              }
            } else {
              const existing = readJobsFromMemory()
              toWrite = [...existing, ...normalized]
              provider = 'memory'
            }
          }
        } else if (REDIS_CONFIGURED) {
          try {
            const existing = await readJobsFromRedis()
            toWrite = [...existing, ...normalized]
            provider = 'redis'
          } catch (e) {
            console.warn('Redis 读取失败（append），改用内存回退:', e?.message || e)
            const existing = readJobsFromMemory()
            toWrite = [...existing, ...normalized]
            provider = 'memory'
          }
        } else {
          const existing = readJobsFromMemory()
          toWrite = [...existing, ...normalized]
          provider = 'memory'
        }
      }

      let saved = [];

      if (REDIS_CONFIGURED) {
        try {
          saved = await writeJobsToRedis(toWrite);
          provider = 'redis';
        } catch (e) {
          console.warn('Redis 写入失败，尝试写入 KV:', e?.message || e);
          if (KV_CONFIGURED) {
            try {
              saved = await writeJobsToKV(toWrite);
              provider = 'vercel-kv';
            } catch (er) {
              console.warn('KV 写入失败，写入到内存:', er?.message || er);
              saved = writeJobsToMemory(toWrite);
              provider = 'memory';
            }
          } else {
            saved = writeJobsToMemory(toWrite);
            provider = 'memory';
          }
        }
      } else if (KV_CONFIGURED) {
        try {
          saved = await writeJobsToKV(toWrite);
          provider = 'vercel-kv';
        } catch (e) {
          console.warn('KV 写入失败，写入到内存:', e?.message || e);
          saved = writeJobsToMemory(toWrite);
          provider = 'memory';
        }
      } else {
        saved = writeJobsToMemory(toWrite);
        provider = 'memory';
      }

      res.setHeader('X-Storage-Provider', provider)
      try { res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED)) } catch {}
      return res.status(200).json({ success: true, saved: saved.length, mode, provider })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('processed-jobs API error:', error)
    try {
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
    } catch {}
    return res.status(500).json({ error: 'Failed to process jobs', message: error?.message || String(error) })
  }
}