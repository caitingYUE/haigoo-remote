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

// 🆕 导入 Neon 数据库帮助类
let neonHelper = null
try {
  neonHelper = require('../../server-utils/dal/neon-helper').default
  console.log('✅ Neon 数据库帮助类已加载')
} catch (error) {
  console.error('❌ Neon 数据库帮助类加载失败:', error.message)
  neonHelper = null
}

const NEON_CONFIGURED = !!neonHelper?.isConfigured

if (!globalThis.__haigoo_processed_jobs_mem) {
  globalThis.__haigoo_processed_jobs_mem = []
}
const MEM = globalThis.__haigoo_processed_jobs_mem

// 表名常量
const JOBS_TABLE = 'jobs'
const FAVORITES_TABLE = 'favorites'

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

const DEFAULT_LOCATION_CATEGORIES = {
  domesticKeywords: ['china', '中国', 'cn', 'apac', 'asia', 'east asia', 'greater china', 'utc+8', 'gmt+8', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chongqing', 'chengdu', 'nanjing', '不限地点'],
  overseasKeywords: ['usa', 'united states', 'us', 'uk', 'england', 'britain', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia', 'latam', 'europe', 'eu', 'emea', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'ireland', 'switzerland', 'australia', 'new zealand', 'oceania', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'japan', 'korea', 'south korea', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'uae', 'saudi', 'turkey', 'russia', 'israel', 'africa'],
  globalKeywords: ['anywhere', 'everywhere', 'worldwide', 'global', '不限地点']
}

async function getLocationCategories() {
  // 目前暂时使用默认配置，未来可以存储在数据库中
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



async function readJobsFromNeon() {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')
  
  try {
    const result = await neonHelper.select(JOBS_TABLE, {}, { orderBy: 'published_at', orderDirection: 'DESC' })
    if (!result || !result.rows) return []
    
    // 将数据库行转换为前端需要的格式
    return result.rows.map(row => ({
      id: row.job_id,
      title: row.title,
      company: row.company,
      location: row.location,
      description: row.description,
      url: row.url,
      publishedAt: row.published_at,
      source: row.source,
      category: row.category,
      salary: row.salary,
      jobType: row.job_type,
      experienceLevel: row.experience_level,
      tags: row.tags || [],
      requirements: row.requirements || [],
      benefits: row.benefits || [],
      isRemote: row.is_remote,
      status: row.status,
      region: row.region,
      translations: row.translations,
      isTranslated: row.is_translated,
      translatedAt: row.translated_at,
      companyId: row.company_id,
      sourceType: row.source_type,
      isTrusted: row.is_trusted,
      canRefer: row.can_refer,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  } catch (e) {
    console.warn('Neon database read error:', e?.message || e)
    return []
  }
}

async function writeJobsToNeon(jobs) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')
  
  const recent = filterRecentJobs(jobs, RETAIN_DAYS)
  const unique = removeDuplicates(recent)
  
  try {
    // 使用事务批量写入
    await neonHelper.transaction(async (sql) => {
      // 先清空表（如果是replace模式）
      await sql.query(`DELETE FROM ${JOBS_TABLE}`)
      
      // 批量插入数据
      for (const job of unique) {
        await sql.query(`
          INSERT INTO ${JOBS_TABLE} (
            job_id, title, company, location, description, url, published_at,
            source, category, salary, job_type, experience_level, tags, 
            requirements, benefits, is_remote, status, region, translations,
            is_translated, translated_at, company_id, source_type, is_trusted, can_refer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        `, [
          job.id,
          job.title,
          job.company,
          job.location,
          job.description,
          job.url,
          job.publishedAt,
          job.source,
          job.category,
          job.salary,
          job.jobType,
          job.experienceLevel,
          JSON.stringify(job.tags || []),
          JSON.stringify(job.requirements || []),
          JSON.stringify(job.benefits || []),
          job.isRemote,
          job.status,
          job.region,
          job.translations ? JSON.stringify(job.translations) : null,
          job.isTranslated,
          job.translatedAt,
          job.companyId,
          job.sourceType,
          job.isTrusted,
          job.canRefer
        ])
      }
    })
    
    console.log(`✅ 成功写入 ${unique.length} 个岗位到 Neon 数据库`)
    return unique
  } catch (e) {
    console.error('Neon database write error:', e?.message || e)
    throw e
  }
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
      const { action } = req.query

      // Stats Action
      if (action === 'stats') {
        let provider = 'neon'
        let jobsCount = 0
        let storageSize = 0
        let lastSync = null

        try {
          // 直接从数据库统计
          if (NEON_CONFIGURED) {
            const result = await neonHelper.count(JOBS_TABLE)
            jobsCount = result || 0
            
            // 估算存储大小（每个岗位约1KB）
            storageSize = jobsCount * 1024
            
            // 获取最新更新时间
            const latestJob = await neonHelper.select(JOBS_TABLE, {}, { 
              orderBy: 'updated_at', 
              orderDirection: 'DESC', 
              limit: 1 
            })
            if (latestJob && latestJob.rows.length > 0) {
              lastSync = latestJob.rows[0].updated_at
            }
            provider = 'neon'
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
      let provider = 'neon'
      const startTime = Date.now()
      // 只使用 Neon 数据库
      if (NEON_CONFIGURED) {
        try {
          jobs = await readJobsFromNeon()
          provider = 'neon'
          console.log(`[processed-jobs] GET: Neon database read success, ${jobs.length} jobs, ${Date.now() - startTime}ms`)
        } catch (e) {
          console.warn(`[processed-jobs] GET: Neon database read failed:`, e?.message || e)
          jobs = []
          provider = 'neon-error'
        }
      } else {
        jobs = []
        provider = 'neon-not-configured'
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

      // 强制禁用缓存，确保前端刷新拿到最新数据
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
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
      let provider = 'neon'
      if (mode === 'append') {
        // 只使用 Neon 数据库
        if (NEON_CONFIGURED) {
          try {
            const existing = await readJobsFromNeon()
            toWrite = [...existing, ...normalized]
            provider = 'neon'
          } catch (e) {
            console.warn(`[processed-jobs] POST append: Neon database read failed:`, e?.message || e)
            toWrite = normalized
            provider = 'neon-error'
          }
        } else {
          toWrite = normalized
          provider = 'neon-not-configured'
        }
      }

      let saved = [];

      // 只使用 Neon 数据库
      if (NEON_CONFIGURED) {
        try {
          saved = await writeJobsToNeon(toWrite);
          provider = 'neon';
        } catch (e) {
          console.warn('Neon 数据库写入失败:', e?.message || e);
          saved = [];
          provider = 'neon-error';
        }
      } else {
        saved = [];
        provider = 'neon-not-configured';
      }

      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
      console.log(`[processed-jobs] POST: Saved ${saved.length} jobs via ${provider}, mode=${mode}`)
      return res.status(200).json({ success: true, saved: saved.length, mode, provider })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('processed-jobs API error:', error)
    try {
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
    } catch { }
    return res.status(500).json({ error: 'Failed to process jobs', message: error?.message || String(error) })
  }
}
