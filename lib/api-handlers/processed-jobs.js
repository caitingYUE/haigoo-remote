// 安全加载 Vercel KV
import { kv } from '@vercel/kv'
import { getAllCompanies } from './trusted-companies.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// let kv = null
// try {
//   const kvModule = require('@vercel/kv')
//   kv = kvModule?.kv || null
// } catch (e) {
//   console.warn('[processed-jobs] Vercel KV module not available, will use fallbacks')
// }

// 统一环境变量解析：兼容 preview 专用前缀（pre_haigoo_*、pre_*、haigoo_* 等）
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

// 🆕 导入翻译服务（从 lib 目录）
let translateJobs = null
try {
  const translationService = require('../../lib/services/translation-service')
  translateJobs = translationService.translateJobs
  console.log('✅ 翻译服务已加载')
} catch (error) {
  console.warn('⚠️ 翻译服务未找到，将跳过自动翻译')
}

// Detect KV configuration (REST-only). Avoid misinterpreting KV_URL without REST creds.
const KV_REST_API_URL = getEnv('KV_REST_API_URL')
const KV_REST_API_TOKEN = getEnv('KV_REST_API_TOKEN')
if (KV_REST_API_URL && !process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = KV_REST_API_URL
if (KV_REST_API_TOKEN && !process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = KV_REST_API_TOKEN
const KV_CONFIGURED = !!(KV_REST_API_URL && KV_REST_API_TOKEN)

// Detect Upstash Redis REST configuration (Preview 优先)
const UPSTASH_REST_URL = getEnv('UPSTASH_REDIS_REST_URL', 'UPSTASH_REST_URL', 'REDIS_REST_API_URL')
const UPSTASH_REST_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REST_TOKEN', 'REDIS_REST_API_TOKEN')
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN)

// Detect Redis configuration (accept multiple env var names)
// Prefer standard REDIS_URL, but also support project-specific or provider-specific names
const REDIS_URL = getEnv('REDIS_URL', 'UPSTASH_REDIS_URL') ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
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

// Retention window in days (env-configurable, defaults to 30)
const RETAIN_DAYS_ENV = getEnv('PROCESSED_JOBS_RETAIN_DAYS', 'RETAIN_DAYS', 'MAX_DAYS')
const RETAIN_DAYS = (() => {
  const n = Number(RETAIN_DAYS_ENV)
  return Number.isFinite(n) && n > 0 ? n : 30
})()

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
  region: 50,
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
function filterRecentJobs(jobs, maxDays = RETAIN_DAYS) {
  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)
  return jobs.filter(j => {
    const d = new Date(j.publishedAt)
    const t = d.getTime()
    // 如果发布时间不可解析，则保留该记录，避免错误数据被误删
    if (!Number.isFinite(t)) return true
    return d >= cutoff
  })
}

function removeDuplicates(jobs) {
  const bestJobs = new Map() // Map<dedupKey, job>

  // 第一遍：找出每个 key 对应的最佳 job
  for (const job of jobs) {
    const key = generateDedupKey(job)
    if (!bestJobs.has(key)) {
      bestJobs.set(key, job)
    } else {
      const existing = bestJobs.get(key)
      // 比较逻辑：优先保留数据更完整的，或者更新时间更晚的
      const existingScore = (existing.description?.length || 0) + (existing.tags?.length || 0)
      const newScore = (job.description?.length || 0) + (job.tags?.length || 0)

      // 如果新数据明显更好（分数更高），或者分数相同但更新时间更晚
      // 注意：如果 job.updatedAt 不存在，new Date(undefined) 会是 Invalid Date，比较结果为 false
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0
      const newTime = job.updatedAt ? new Date(job.updatedAt).getTime() : 0

      if (newScore > existingScore || (newScore === existingScore && newTime > existingTime)) {
        bestJobs.set(key, job)
      }
    }
  }

  return Array.from(bestJobs.values())
}

const DEFAULT_LOCATION_CATEGORIES = {
  domesticKeywords: ['china', '中国', 'cn', 'apac', 'asia', 'east asia', 'greater china', 'utc+8', 'gmt+8', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chongqing', 'chengdu', 'nanjing', '不限地点'],
  overseasKeywords: ['usa', 'united states', 'us', 'uk', 'england', 'britain', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia', 'latam', 'europe', 'eu', 'emea', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'ireland', 'switzerland', 'australia', 'new zealand', 'oceania', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'japan', 'korea', 'south korea', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'uae', 'saudi', 'turkey', 'russia', 'israel', 'africa'],
  globalKeywords: ['anywhere', 'everywhere', 'worldwide', 'global', '不限地点']
}

async function getLocationCategories() {
  const key = 'haigoo:location_categories'
  try {
    if (UPSTASH_REST_CONFIGURED) {
      const data = await upstashGet(key)
      if (data) return typeof data === 'string' ? JSON.parse(data) : data
    }
    if (REDIS_CONFIGURED) {
      const client = await getRedisClient()
      const data = await client.get(key)
      if (data) return JSON.parse(data)
    }
    if (KV_CONFIGURED) {
      const data = await kv.get(key)
      if (data) return data
    }
  } catch (e) {
    console.warn('Failed to fetch location categories', e)
  }
  return DEFAULT_LOCATION_CATEGORIES
}

function applyFilters(jobs, q, categories = DEFAULT_LOCATION_CATEGORIES) {
  let list = jobs
  if (Array.isArray(q.ids) && q.ids.length > 0) {
    const idSet = new Set(q.ids.map(String))
    list = list.filter(j => idSet.has(String(j.id)))
  }
  if (q.id) list = list.filter(j => j.id === q.id)
  if (q.source) list = list.filter(j => j.source === q.source)
  if (q.category) list = list.filter(j => j.category === q.category)
  if (q.status) list = list.filter(j => j.status === q.status)
  if (q.company) list = list.filter(j => (j.company || '').toLowerCase().includes(String(q.company).toLowerCase()))
  if (typeof q.isRemote !== 'undefined') list = list.filter(j => !!j.isRemote === (q.isRemote === true || q.isRemote === 'true'))
  if (q.location) list = list.filter(j => (j.location || '').toLowerCase().includes(String(q.location).toLowerCase()))
  if (q.type) list = list.filter(j => (j.jobType || j.type) === q.type)
  if (typeof q.isFeatured !== 'undefined') list = list.filter(j => !!j.isFeatured === (q.isFeatured === true || q.isFeatured === 'true'))

  // Region Filter
  if (q.region) {
    const region = String(q.region).toLowerCase()
    const norm = (v) => (v || '').toLowerCase()

    list = list.filter(job => {
      const loc = norm(job.location)
      const tags = (job.tags || []).map(t => norm(t))

      const pool = new Set([loc, ...tags])
      const hit = (keys) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))

      const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
      const domesticHit = hit(categories.domesticKeywords)
      const overseasHit = hit(categories.overseasKeywords)

      if (region === 'domestic') return globalHit || domesticHit
      if (region === 'overseas') return globalHit || overseasHit
      return true
    })
  }

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
  if (!kv) return []
  const data = await kv.get(JOBS_KEY)
  if (!data) return []
  const jobs = Array.isArray(data) ? data : JSON.parse(typeof data === 'string' ? data : '[]')
  return jobs
}

// --- Upstash Redis REST helpers ---
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
  } catch (e) {
    // ignore, try POST fallback
  }
  const res2 = await fetch(`${UPSTASH_REST_URL}/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: JSON.stringify({ key })
  })
  const json2 = await res2.json().catch(() => null)
  return json2?.result ?? null
}

async function upstashSet(key, value) {
  if (!UPSTASH_REST_CONFIGURED) throw new Error('Upstash REST not configured')
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  try {
    const res = await fetch(`${UPSTASH_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REST_TOKEN}` }
    })
    if (res.ok) return true
  } catch (e) {
    // try JSON endpoint
  }
  const res2 = await fetch(`${UPSTASH_REST_URL}/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: JSON.stringify({ key, value: serialized })
  })
  return res2.ok
}

async function readJobsFromUpstashREST() {
  const data = await upstashGet(JOBS_KEY)
  if (!data) return []
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('Upstash REST get parse error:', e?.message || e)
    return []
  }
}

async function writeJobsToUpstashREST(jobs) {
  const recent = filterRecentJobs(jobs, RETAIN_DAYS)
  const unique = removeDuplicates(recent)
  await upstashSet(JOBS_KEY, JSON.stringify(unique))
  await upstashSet(LAST_SYNC_KEY, new Date().toISOString())
  await upstashSet(STATS_KEY, JSON.stringify({
    totalJobs: unique.length,
    storageSize: JSON.stringify(unique).length,
    lastSync: new Date().toISOString(),
    provider: 'upstash-rest'
  }))
  return unique
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
  if (!kv) return jobs
  const recent = filterRecentJobs(jobs, RETAIN_DAYS)
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
  const recent = filterRecentJobs(jobs, RETAIN_DAYS)
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

// Exported helpers for other services (e.g. Cron Jobs)
export async function getAllJobs() {
  let jobs = []
  try {
    if (UPSTASH_REST_CONFIGURED) jobs = await readJobsFromUpstashREST()
    else if (REDIS_CONFIGURED) jobs = await readJobsFromRedis()
    else if (KV_CONFIGURED) jobs = await readJobsFromKV()
    else jobs = readJobsFromMemory()
  } catch (e) {
    console.error('[getAllJobs] Error:', e)
  }
  return jobs
}

export async function saveAllJobs(jobs) {
  try {
    if (UPSTASH_REST_CONFIGURED) return await writeJobsToUpstashREST(jobs)
    else if (REDIS_CONFIGURED) return await writeJobsToRedis(jobs)
    else if (KV_CONFIGURED) return await writeJobsToKV(jobs)
    else return writeJobsToMemory(jobs)
  } catch (e) {
    console.error('[saveAllJobs] Error:', e)
    return jobs
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 缓存策略：CDN 缓存 60 秒，后台更新 5 分钟
  // 这能显著减少 Fast Origin Transfer 消耗
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      const { action } = req.query

      // Stats Action
      if (action === 'stats') {
        let provider = 'memory'
        let jobsCount = 0
        let storageSize = 0
        let lastSync = null

        try {
          // Try to read pre-calculated stats first
          if (UPSTASH_REST_CONFIGURED) {
            const stats = await upstashGet(STATS_KEY)
            if (stats) {
              const s = typeof stats === 'string' ? JSON.parse(stats) : stats
              jobsCount = s.totalJobs || 0
              storageSize = s.storageSize || 0
              lastSync = s.lastSync || null
              provider = 'upstash-rest'
            }
          } else if (REDIS_CONFIGURED) {
            const client = await getRedisClient()
            const statsStr = await client.get(STATS_KEY)
            if (statsStr) {
              const s = JSON.parse(statsStr)
              jobsCount = s.totalJobs || 0
              storageSize = s.storageSize || 0
              lastSync = s.lastSync || null
              provider = 'redis'
            }
          } else if (KV_CONFIGURED && kv) {
            const stats = await kv.get(STATS_KEY)
            if (stats) {
              jobsCount = stats.totalJobs || 0
              storageSize = stats.storageSize || 0
              lastSync = stats.lastSync || null
              provider = 'vercel-kv'
            }
          }

          // Fallback: if no stats found, count jobs
          if (jobsCount === 0) {
            let jobs = []
            if (UPSTASH_REST_CONFIGURED) jobs = await readJobsFromUpstashREST()
            else if (REDIS_CONFIGURED) jobs = await readJobsFromRedis()
            else if (KV_CONFIGURED) jobs = await readJobsFromKV()
            else jobs = readJobsFromMemory()

            jobsCount = jobs.length
            storageSize = JSON.stringify(jobs).length
          }

          return res.status(200).json({
            provider,
            totalJobs: jobsCount,
            storageSize,
            lastSync
          })
        } catch (e) {
          console.error('[processed-jobs] Stats error:', e)
          return res.status(500).json({ error: 'Failed to fetch stats' })
        }
      }

      const {
        page = '1',
        limit = '50',
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
        skills,
        id,
        region
      } = req.query || {}

      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 50

      // Fetch location categories for filtering
      const categories = await getLocationCategories()

      let jobs = []
      let provider = 'memory'
      const startTime = Date.now()
      // 统一策略：优先 Upstash REST -> 其次 Redis TCP -> 再次 KV -> 最后内存
      if (UPSTASH_REST_CONFIGURED) {
        try {
          jobs = await readJobsFromUpstashREST()
          provider = 'upstash-rest'
          console.log(`[processed-jobs] GET: Upstash REST read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
        } catch (e) {
          console.warn(`[processed-jobs] GET: Upstash REST read failed, fallback to Redis:`, e?.message || e)
          if (REDIS_CONFIGURED) {
            try {
              jobs = await readJobsFromRedis()
              provider = 'redis'
              console.log(`[processed-jobs] GET: Redis read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
            } catch (er) {
              console.warn(`[processed-jobs] GET: Redis read failed, fallback to KV:`, er?.message || er)
              if (KV_CONFIGURED) {
                try {
                  jobs = await readJobsFromKV()
                  provider = 'vercel-kv'
                  console.log(`[processed-jobs] GET: KV read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
                } catch (err2) {
                  console.warn(`[processed-jobs] GET: KV read failed, fallback to memory:`, err2?.message || err2)
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
            } catch (err3) {
              console.warn(`[processed-jobs] GET: KV read failed, fallback to memory:`, err3?.message || err3)
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
          type,
          type,
          tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []),
          skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? [skills] : []),
          id,
          region
        }, categories)
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

      // DEBUG: Log first few jobs to check for companyId
      if (items.length > 0) {
        const debugJobs = items.slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          companyId: j.companyId,
          sourceType: j.sourceType
        }))
        console.log('[processed-jobs] Debug Response Jobs:', JSON.stringify(debugJobs))
      }

      // 缓存策略：CDN 缓存 60 秒，后台更新 5 分钟
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
      res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
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
      let normalized = jobs.map(j => {
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
        const region = truncateString(String(j.region || 'overseas'), FIELD_LIMITS.region)

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
          updatedAt: new Date().toISOString(),
          region,
          // 🆕 翻译字段
          translations: j.translations || null,
          isTranslated: j.isTranslated || false,
          translatedAt: j.translatedAt || null,
          // Trusted Company Fields
          companyId: j.companyId || null,
          sourceType: j.sourceType || 'rss',
          isTrusted: !!j.isTrusted,
          canRefer: !!j.canRefer
        }
      })

      // 尝试匹配受信任公司
      try {
        const companies = await getAllCompanies()
        for (const job of normalized) {
          const c = companies.find(tc => (tc.name || '').toLowerCase() === (job.company || '').toLowerCase())
          if (c) {
            let changed = false
            if (!job.companyWebsite && c.website) { job.companyWebsite = c.website; changed = true }
            if (!job.companyDescription && c.description) { job.companyDescription = c.description; changed = true }
            if (c.id) job.companyId = c.id
            job.isTrusted = true
          }
        }
      } catch (e) { console.warn('Enrichment error', e) }

      // 自动翻译强制禁用
      const shouldTranslate = false

      if (translateJobs && shouldTranslate) {
        try {
          console.log('🌍 启动自动翻译（LibreTranslate 优先，经代理）...')
          normalized = await translateJobs(normalized)
          console.log('✅ 自动翻译完成')
        } catch (translationError) {
          console.error('❌ 自动翻译失败:', translationError.message)
          // 翻译失败不影响保存流程
        }
      } else if (!shouldTranslate) {
        console.log('ℹ️ 自动翻译已禁用（ENABLE_AUTO_TRANSLATION != true）')
      }

      let toWrite = normalized
      let provider = 'memory'
      if (mode === 'append') {
        // 统一策略：优先 Upstash REST -> 其次 Redis -> 再次 KV -> 最后内存
        if (UPSTASH_REST_CONFIGURED) {
          try {
            const existing = await readJobsFromUpstashREST()
            toWrite = [...existing, ...normalized]
            provider = 'upstash-rest'
          } catch (e) {
            console.warn(`[processed-jobs] POST append: Upstash REST read failed, fallback to Redis:`, e?.message || e)
            if (REDIS_CONFIGURED) {
              try {
                const existing = await readJobsFromRedis()
                toWrite = [...existing, ...normalized]
                provider = 'redis'
              } catch (er) {
                console.warn(`[processed-jobs] POST append: Redis read failed, fallback to KV:`, er?.message || er)
                if (KV_CONFIGURED) {
                  try {
                    const existing = await readJobsFromKV()
                    toWrite = [...existing, ...normalized]
                    provider = 'vercel-kv'
                  } catch (er2) {
                    console.warn(`[processed-jobs] POST append: KV read failed, fallback to memory:`, er2?.message || er2)
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
              } catch (er3) {
                console.warn(`[processed-jobs] POST append: KV read failed, fallback to memory:`, er3?.message || er3)
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

      if (UPSTASH_REST_CONFIGURED) {
        try {
          saved = await writeJobsToUpstashREST(toWrite);
          provider = 'upstash-rest';
        } catch (e) {
          console.warn('Upstash REST 写入失败，尝试写入 Redis:', e?.message || e);
          if (REDIS_CONFIGURED) {
            try {
              saved = await writeJobsToRedis(toWrite);
              provider = 'redis';
            } catch (er) {
              console.warn('Redis 写入失败，尝试写入 KV:', er?.message || er);
              if (KV_CONFIGURED) {
                try {
                  saved = await writeJobsToKV(toWrite);
                  provider = 'vercel-kv';
                } catch (er2) {
                  console.warn('KV 写入失败，写入到内存:', er2?.message || er2);
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
            } catch (er3) {
              console.warn('KV 写入失败，写入到内存:', er3?.message || er3);
              saved = writeJobsToMemory(toWrite);
              provider = 'memory';
            }
          } else {
            saved = writeJobsToMemory(toWrite);
            provider = 'memory';
          }
        }
      } else if (REDIS_CONFIGURED) {
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
      res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
      console.log(`[processed-jobs] POST: Saved ${saved.length} jobs via ${provider}, mode=${mode}`)
      return res.status(200).json({ success: true, saved: saved.length, mode, provider })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('processed-jobs API error:', error)
    try {
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
      res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
    } catch { }
    return res.status(500).json({ error: 'Failed to process jobs', message: error?.message || String(error) })
  }
}
