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

// Field length limits (bytes)
const FIELD_LIMITS = {
  title: 500,
  company: 200,
  location: 200,
  description: 50000, // 50KB
  url: 2000,
  source: 100,
  category: 100,
  salary: 200,
  jobType: 50,
  experienceLevel: 50,
  tags: 1000, // total for all tags
  requirements: 10000, // total for all requirements
  benefits: 10000 // total for all benefits
}

// HTML sanitization helper (basic)
function sanitizeHtml(text) {
  if (!text || typeof text !== 'string') return ''
  // Remove script and style tags
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .trim()
}

// Truncate string to byte limit
function truncateString(str, maxBytes) {
  if (!str || typeof str !== 'string') return ''
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  if (bytes.length <= maxBytes) return str
  // Truncate and decode back
  const truncated = bytes.slice(0, maxBytes)
  const decoder = new TextDecoder()
  let result = decoder.decode(truncated)
  // Remove potentially incomplete UTF-8 character at the end
  while (encoder.encode(result).length > maxBytes) {
    result = result.slice(0, -1)
  }
  return result
}

// Generate stable deduplication key
function generateDedupKey(job) {
  // Prefer id if exists and is stable
  if (job.id && typeof job.id === 'string' && job.id.length > 0 && !job.id.includes('random')) {
    return `id:${job.id}`
  }
  // Fallback to title+company+url hash
  const title = (job.title || '').toLowerCase().trim()
  const company = (job.company || '').toLowerCase().trim()
  const url = (job.url || '').toLowerCase().trim()
  const key = `${title}|${company}|${url}`
  // Simple hash function for stability
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `hash:${Math.abs(hash).toString(36)}`
}

// Helpers: recent filter and duplicate removal (keep last 7 days, dedupe by stable key)
function filterRecentJobs(jobs, maxDays = 7) {
  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)
  return jobs.filter(j => new Date(j.publishedAt) >= cutoff)
}

function removeDuplicates(jobs) {
  const seen = new Map() // Map<dedupKey, job>
  return jobs.filter(job => {
    const key = generateDedupKey(job)
    if (seen.has(key)) {
      // Keep the one with more complete data or newer updatedAt
      const existing = seen.get(key)
      const existingScore = (existing.description?.length || 0) + (existing.tags?.length || 0)
      const newScore = (job.description?.length || 0) + (job.tags?.length || 0)
      if (newScore > existingScore || (new Date(job.updatedAt || 0) > new Date(existing.updatedAt || 0))) {
        seen.set(key, job)
      }
      return false
    }
    seen.set(key, job)
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
      const startTime = Date.now()
      // 统一策略：优先 Redis -> 其次 KV -> 最后内存
      if (REDIS_CONFIGURED) {
        try {
          jobs = await readJobsFromRedis()
          provider = 'redis'
          console.log(`[processed-jobs] GET: Redis read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
        } catch (e) {
          console.warn(`[processed-jobs] GET: Redis read failed, fallback to KV:`, e?.message || e)
          if (KV_CONFIGURED) {
            try {
              jobs = await readJobsFromKV()
              provider = 'vercel-kv'
              console.log(`[processed-jobs] GET: KV read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
            } catch (er) {
              console.warn(`[processed-jobs] GET: KV read failed, fallback to memory:`, er?.message || er)
              jobs = readJobsFromMemory()
              provider = 'memory'
            }
          } else {
            jobs = readJobsFromMemory()
            provider = 'memory'
          }
        }
      } else if (KV_CONFIGURED) {
        try {
          jobs = await readJobsFromKV()
          provider = 'vercel-kv'
          console.log(`[processed-jobs] GET: KV read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
        } catch (e) {
          console.warn(`[processed-jobs] GET: KV read failed, fallback to memory:`, e?.message || e)
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
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
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

      // Normalize, validate, sanitize, and truncate fields
      const normalized = jobs.map(j => {
        // Sanitize and truncate fields
        const title = truncateString(sanitizeHtml(String(j.title || '')), FIELD_LIMITS.title)
        const company = truncateString(sanitizeHtml(String(j.company || 'Unknown Company')), FIELD_LIMITS.company)
        const location = truncateString(sanitizeHtml(String(j.location || 'Remote')), FIELD_LIMITS.location)
        const description = truncateString(sanitizeHtml(String(j.description || '')), FIELD_LIMITS.description)
        const url = truncateString(String(j.url || ''), FIELD_LIMITS.url)
        const source = truncateString(String(j.source || 'unknown'), FIELD_LIMITS.source)
        const category = truncateString(String(j.category || '其他'), FIELD_LIMITS.category)
        const salary = j.salary ? truncateString(String(j.salary), FIELD_LIMITS.salary) : null
        const jobType = truncateString(String(j.jobType || 'full-time'), FIELD_LIMITS.jobType)
        const experienceLevel = truncateString(String(j.experienceLevel || 'Mid'), FIELD_LIMITS.experienceLevel)
        
        // Process arrays with limits
        let tags = Array.isArray(j.tags) ? j.tags : []
        tags = tags.slice(0, 50).map(t => truncateString(String(t), 50)) // Max 50 tags, each 50 chars
        const tagsTotal = tags.join('').length
        if (tagsTotal > FIELD_LIMITS.tags) {
          // Truncate tags if total exceeds limit
          let truncated = []
          let currentLength = 0
          for (const tag of tags) {
            if (currentLength + tag.length > FIELD_LIMITS.tags) break
            truncated.push(tag)
            currentLength += tag.length
          }
          tags = truncated
        }
        
        let requirements = Array.isArray(j.requirements) ? j.requirements : []
        requirements = requirements.slice(0, 100).map(r => truncateString(sanitizeHtml(String(r)), 500))
        const reqTotal = requirements.join('').length
        if (reqTotal > FIELD_LIMITS.requirements) {
          let truncated = []
          let currentLength = 0
          for (const req of requirements) {
            if (currentLength + req.length > FIELD_LIMITS.requirements) break
            truncated.push(req)
            currentLength += req.length
          }
          requirements = truncated
        }
        
        let benefits = Array.isArray(j.benefits) ? j.benefits : []
        benefits = benefits.slice(0, 100).map(b => truncateString(sanitizeHtml(String(b)), 500))
        const benTotal = benefits.join('').length
        if (benTotal > FIELD_LIMITS.benefits) {
          let truncated = []
          let currentLength = 0
          for (const ben of benefits) {
            if (currentLength + ben.length > FIELD_LIMITS.benefits) break
            truncated.push(ben)
            currentLength += ben.length
          }
          benefits = truncated
        }
        
        // Generate stable ID if not provided
        let id = j.id
        if (!id || typeof id !== 'string' || id.length === 0) {
          const dedupKey = generateDedupKey({ title, company, url })
          id = dedupKey.startsWith('id:') ? dedupKey.slice(3) : `${title.substring(0, 30)}-${company.substring(0, 20)}-${Date.now()}`
        }
        
        return {
          id,
          title,
          company,
          location,
          description,
          url,
          publishedAt: j.publishedAt || new Date().toISOString(),
          source,
          category,
          salary,
          jobType,
          experienceLevel,
          tags,
          requirements,
          benefits,
          isRemote: typeof j.isRemote === 'boolean' ? j.isRemote : true,
          status: j.status || 'active',
          createdAt: j.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      let toWrite = normalized
      let provider = 'memory'
      if (mode === 'append') {
        // 统一策略：优先 Redis -> 其次 KV -> 最后内存
        if (REDIS_CONFIGURED) {
          try {
            const existing = await readJobsFromRedis()
            toWrite = [...existing, ...normalized]
            provider = 'redis'
          } catch (e) {
            console.warn(`[processed-jobs] POST append: Redis read failed, fallback to KV:`, e?.message || e)
            if (KV_CONFIGURED) {
              try {
                const existing = await readJobsFromKV()
                toWrite = [...existing, ...normalized]
                provider = 'vercel-kv'
              } catch (er) {
                console.warn(`[processed-jobs] POST append: KV read failed, fallback to memory:`, er?.message || er)
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
        } else if (KV_CONFIGURED) {
          try {
            const existing = await readJobsFromKV()
            toWrite = [...existing, ...normalized]
            provider = 'vercel-kv'
          } catch (e) {
            console.warn(`[processed-jobs] POST append: KV read failed, fallback to memory:`, e?.message || e)
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
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
      console.log(`[processed-jobs] POST: Saved ${saved.length} jobs via ${provider}, mode=${mode}`)
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