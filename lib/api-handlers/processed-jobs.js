import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'


// Helper to fetch all trusted companies for matching
async function getAllCompanies() {
  if (!NEON_CONFIGURED) return []
  try {
    // Only need essential fields for matching
    const result = await neonHelper.query(`
      SELECT company_id as id, name, website, careers_page as "careersPage", description 
      FROM trusted_companies 
      WHERE status = 'active'
    `)
    return result || []
  } catch (e) {
    console.error('Failed to fetch trusted companies for matching:', e)
    return []
  }
}

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
  // 使用动态导入来兼容ES模块环境中的CommonJS模块
  const translationService = await import('../services/translation-service.cjs')
  translateJobs = translationService.default?.translateJobs || translationService.translateJobs
  console.log('✅ 翻译服务已加载')
} catch (error) {
  console.warn('⚠️ 翻译服务未找到，将跳过自动翻译:', error.message)
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
  // Fallback to title+company+url+sourceType hash to allow duplicates from different sources
  const title = (job.title || '').toLowerCase().trim()
  const company = (job.company || '').toLowerCase().trim()
  const url = (job.url || '').toLowerCase().trim()
  const sourceType = (job.sourceType || 'unknown').toLowerCase().trim()

  // Use a simpler key combining logic but include sourceType to differentiate
  const key = `${title}|${company}|${url}|${sourceType}`

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
  // 目前暂时使用默认配置，未来可以存储在数据库中
  return DEFAULT_LOCATION_CATEGORIES
}

// 构建数据库查询条件
function buildWhereClause(queryParams) {
  const conditions = []
  const params = []
  let paramIndex = 1

  // 基本字段过滤
  if (queryParams.id) {
    conditions.push(`job_id = $${paramIndex}`)
    params.push(queryParams.id)
    paramIndex++
  }

  if (queryParams.source) {
    conditions.push(`source ILIKE $${paramIndex}`)
    params.push(queryParams.source)
    paramIndex++
  }

  // Handle sourceType filter
  if (queryParams.sourceType || queryParams.sourceFilter) {
    const types = (queryParams.sourceType || queryParams.sourceFilter).split(',');

    // Check for specific source types
    const hasClubReferral = types.includes('club-referral') || types.includes('referral');
    // Frontend sends 'trusted', backend used to expect 'curated'
    const hasTrusted = types.includes('trusted') || types.includes('curated');
    // Frontend sends 'rss', backend used to expect 'third-party'
    const hasRss = types.includes('rss') || types.includes('third-party') || types.includes('platform');
    // Official Website
    const hasOfficial = types.includes('official');

    // If multiple types are selected, we need OR logic
    const sourceConditions = [];

    if (hasClubReferral) {
      sourceConditions.push('can_refer = true');
    }

    if (hasTrusted) {
      // Trusted Company but NOT Referral
      sourceConditions.push('((is_trusted = true OR source_type = \'trusted\') AND can_refer IS NOT TRUE)');
    }

    if (hasOfficial) {
      // Official Website Jobs: is_trusted = true AND source_type = 'official' (if distinct) or just is_trusted
      // Based on UI logic: job.isTrusted but not canRefer is "Official Website"
      // Actually, UI logic says: 
      // job.canRefer -> Referral
      // job.isTrusted -> Official/Trusted (Orange badge)
      // So "Trusted" and "Official" might be the same in current DB schema unless differentiated by source_type
      // Let's assume 'official' maps to the Orange badge logic: is_trusted=true, can_refer=false
      sourceConditions.push('((is_trusted = true OR source_type = \'trusted\') AND can_refer IS NOT TRUE)');
    }

    if (hasRss) {
      // RSS/Third-party means NOT can_refer AND NOT is_trusted (handling NULLs safely)
      sourceConditions.push('((can_refer IS NOT TRUE) AND (is_trusted IS NOT TRUE))');
    }

    if (sourceConditions.length > 0) {
      conditions.push(`(${sourceConditions.join(' OR ')})`);
    }
  }

  if (queryParams.category) {
    conditions.push(`category = $${paramIndex}`)
    params.push(queryParams.category)
    paramIndex++
  }

  if (queryParams.status) {
    conditions.push(`status = $${paramIndex}`)
    params.push(queryParams.status)
    paramIndex++
  }

  // Handle search (support both 'search' and 'searchQuery')
  const searchTerm = queryParams.search || queryParams.searchQuery
  if (searchTerm) {
    conditions.push(`(
      title ILIKE $${paramIndex} OR 
      company ILIKE $${paramIndex} OR 
      description ILIKE $${paramIndex} OR
      location ILIKE $${paramIndex} OR
      category ILIKE $${paramIndex} OR
      job_type ILIKE $${paramIndex} OR
      tags::text ILIKE $${paramIndex}
    )`)
    params.push(`%${searchTerm}%`)
    paramIndex++
  }

  // Handle category (multi-select)
  if (queryParams.category) {
    conditions.push(`category = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(queryParams.category)
    paramIndex++
  }

  // Handle status
  if (queryParams.status) {
    conditions.push(`status = $${paramIndex}`)
    params.push(queryParams.status)
    paramIndex++
  }

  // Handle company (fuzzy)
  if (queryParams.company) {
    conditions.push(`company ILIKE $${paramIndex}`)
    params.push(`%${queryParams.company}%`)
    paramIndex++
  }

  // Handle isRemote
  if (typeof queryParams.isRemote !== 'undefined') {
    conditions.push(`is_remote = $${paramIndex}`)
    params.push(queryParams.isRemote === 'true' || queryParams.isRemote === true)
    paramIndex++
  }

  // Handle isFeatured
  if (typeof queryParams.isFeatured !== 'undefined') {
    conditions.push(`is_featured = $${paramIndex}`)
    params.push(queryParams.isFeatured === 'true' || queryParams.isFeatured === true)
    paramIndex++
  }

  // Handle canRefer
  if (typeof queryParams.canRefer !== 'undefined') {
    conditions.push(`can_refer = $${paramIndex}`)
    params.push(queryParams.canRefer === 'true' || queryParams.canRefer === true)
    paramIndex++
  }

  // Handle isTrusted
  if (typeof queryParams.isTrusted !== 'undefined') {
    conditions.push(`is_trusted = $${paramIndex}`)
    params.push(queryParams.isTrusted === 'true' || queryParams.isTrusted === true)
    paramIndex++
  }

  // Handle isNew (published within last 3 days)
  if (queryParams.isNew === 'true' || queryParams.isNew === true) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    conditions.push(`published_at >= $${paramIndex}`)
    params.push(threeDaysAgo)
    paramIndex++
  }

  // Handle region (domestic/overseas/global)
  // New Logic (2025-12-22):
  // - domestic: region IN ('domestic', 'global')
  // - overseas: region IN ('overseas', 'global')
  // - global: region = 'global' (if explicitly requested, though usually covered by above)
  if (queryParams.region) {
    if (queryParams.region === 'domestic') {
      conditions.push(`region IN ('domestic', 'global')`)
    } else if (queryParams.region === 'overseas') {
      conditions.push(`region IN ('overseas', 'global')`)
    } else {
      // Fallback for specific exact match
      conditions.push(`region = $${paramIndex}`)
      params.push(queryParams.region)
      paramIndex++
    }
  }

  // Handle jobType (multi-select) - maps to job_type column
  // Frontend sends 'jobType' or 'type'
  const jobType = queryParams.jobType || queryParams.type
  if (jobType) {
    conditions.push(`job_type = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(jobType)
    paramIndex++
  }

  // Handle experienceLevel (multi-select) - maps to experience_level column
  if (queryParams.experienceLevel) {
    conditions.push(`experience_level = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(queryParams.experienceLevel)
    paramIndex++
  }

  // Handle industry (multi-select) - now maps to industry column
  if (queryParams.industry) {
    const industries = queryParams.industry.split(',')
    conditions.push(`industry = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(queryParams.industry)
    paramIndex++
  }

  // Handle salary (range check)
  // Assuming DB has salary_min and salary_max columns. If not, this will fail.
  // Given the user said "fields don't match", and previous code treated salary as text, 
  // we'll try to match text if numeric columns don't exist. 
  // But standard implementation requires numeric columns.
  // For safety, let's skip salary filter implementation unless we are sure about schema,
  // OR try a text match for ranges (very weak).
  // Better approach: Since I can't see DDL, I'll assume salary is text and skip complex filtering to avoid crashing.
  // Or I can check if queryParams.salary is provided and try to do nothing or log warning.

  if (typeof queryParams.isManuallyEdited !== 'undefined') {
    // Optional: add handling if column exists
  }

  // Tags filtering (JSONB)
  if (queryParams.tags) {
    const tags = Array.isArray(queryParams.tags) ? queryParams.tags : queryParams.tags.split(',')
    if (tags.length > 0) {
      conditions.push(`tags ?| $${paramIndex}`)
      params.push(tags)
      paramIndex++
    }
  }

  // 日期范围过滤
  if (queryParams.dateFrom) {
    conditions.push(`published_at >= $${paramIndex}`)
    params.push(new Date(queryParams.dateFrom).toISOString())
    paramIndex++
  }

  if (queryParams.dateTo) {
    conditions.push(`published_at <= $${paramIndex}`)
    params.push(new Date(queryParams.dateTo).toISOString())
    paramIndex++
  }


  // Handle Region (supports multiple regions: domestic,overseas)
  const regionParam = queryParams.regionType || queryParams.region
  if (regionParam) {
    const regions = String(regionParam).toLowerCase().split(',')
    const regionConditions = []

    if (regions.includes('domestic')) {
      // 国内：region 为 'domestic' 或 'both'
      regionConditions.push(`region IN ('domestic', 'both')`)
    }

    if (regions.includes('overseas')) {
      // 海外：region 为 'overseas' 或 'both'
      regionConditions.push(`region IN ('overseas', 'both')`)
    }

    if (regionConditions.length > 0) {
      conditions.push(`(${regionConditions.join(' OR ')})`)
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

// Helper: Map DB row to Job object with region correction
function mapRowToJob(row) {
  // 直接使用数据库中的 region 字段，不做额外计算，确保前后端一致
  // 如果数据库中 region 为空（旧数据），尝试实时计算作为兜底
  const effectiveRegion = row.region || classifyRegion(row.location);

  // 确保 sourceType 总是返回正确的值 (Third Party Fallback Logic)
  let finalSourceType = row.source_type;

  // If is_trusted is true, ensure sourceType is 'official' (unless it's referral)
  // 修正：确保大小写不敏感匹配，以及处理 'trusted' 类型的兼容性
  if (row.is_trusted) {
    const st = (finalSourceType || '').toLowerCase();
    if (st !== 'referral' && st !== 'club-referral') {
      finalSourceType = 'official';
    }
  }

  if (!finalSourceType) {
    if (!row.can_refer && !row.is_trusted) {
      finalSourceType = 'rss'; // 默认为 RSS/Third Party
    } else if (row.is_trusted) {
      finalSourceType = 'official';
    }
  }

  const safeJsonParse = (val, fallback) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        // console.warn('JSON parse error in mapRowToJob:', e.message);
        return fallback;
      }
    }
    return val || fallback;
  };

  // DEBUG: Check for suspicious values
  if (row.job_type === 'full-time' && row.source === 'crawled' && row.region === 'unclassified') {
      // console.log(`[mapRowToJob] Suspicious job data for ID ${row.job_id}:`, row);
  }

  return {
    id: row.job_id,
    title: row.title,
    company: row.company,
    location: row.location,
    description: row.description,
    url: row.url,
    sourceUrl: row.url,
    logo: row.trusted_logo || row.company_logo || undefined,
    publishedAt: row.published_at,
    source: row.source,
    category: row.category,
    salary: row.salary,
    jobType: row.job_type,
    experienceLevel: row.experience_level,
    tags: safeJsonParse(row.tags, []),
    requirements: safeJsonParse(row.requirements, []),
    benefits: safeJsonParse(row.benefits, []),
    isRemote: row.is_remote,
    status: row.status,
    region: effectiveRegion,
    translations: safeJsonParse(row.translations, null),
    isTranslated: row.is_translated,
    translatedAt: row.translated_at,
    companyId: row.company_id,
    sourceType: finalSourceType,
    isTrusted: row.is_trusted,
    canRefer: row.can_refer,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Match score fields (optional)
    matchScore: row.match_score || 0,
    matchUpdatedAt: row.match_updated_at,
    // Company fields
    companyWebsite: row.trusted_website, // Strict: use trusted_companies website
    companyLogo: row.trusted_logo, // New: use trusted_companies logo
    companyTags: row.company_tags,
    companyIndustry: row.industry, // Map database 'industry' column to 'companyIndustry'
    industry: row.industry,
    isManuallyEdited: row.is_manually_edited,
    // Member-only fields (may be masked later)
    riskRating: safeJsonParse(row.risk_rating, null),
    haigooComment: row.haigoo_comment,
    hiddenFields: safeJsonParse(row.hidden_fields, null)
  };
}

// Helper: Filter job based on region query params
function filterJobByRegion(job, queryParams) {
  const regionParam = queryParams.regionType || queryParams.region;
  if (!regionParam) return true;

  const regions = String(regionParam).toLowerCase().split(',');
  const isDomesticReq = regions.includes('domestic');
  const isOverseasReq = regions.includes('overseas');

  if (isDomesticReq && !isOverseasReq) {
    return job.region === 'domestic' || job.region === 'both';
  }
  if (isOverseasReq && !isDomesticReq) {
    return job.region === 'overseas' || job.region === 'both';
  }
  return true;
}

async function readJobsFromNeon(queryParams = {}, pagination = {}) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  try {
    const { where, params } = buildWhereClause(queryParams)
    const { page = 1, limit = 50 } = pagination
    const offset = (page - 1) * limit

    let orderByClause = ''
    
    // Search Relevance Sorting
    if (queryParams.search) {
      // Add search term to params for sorting usage
      params.push(`%${queryParams.search}%`)
      const termIndex = params.length
      
      orderByClause = `ORDER BY (
        CASE WHEN title ILIKE $${termIndex} THEN 10 ELSE 0 END +
        CASE WHEN description ILIKE $${termIndex} THEN 1 ELSE 0 END
      ) DESC, published_at DESC`
    } 
    // Recent Sorting
    else if (queryParams.sortBy === 'recent') {
      orderByClause = 'ORDER BY published_at DESC'
    } 
    // Default / "Relevance" (Business Logic)
    else {
      orderByClause = `ORDER BY 
        CASE WHEN can_refer = true THEN 1 ELSE 0 END DESC,
        CASE WHEN is_trusted = true THEN 1 ELSE 0 END DESC,
        published_at DESC`
    }

    const query = `
      SELECT *, 
        (SELECT website FROM trusted_companies tc WHERE tc.company_id = ${JOBS_TABLE}.company_id) as trusted_website,
        (SELECT logo FROM trusted_companies tc WHERE tc.company_id = ${JOBS_TABLE}.company_id) as trusted_logo
      FROM ${JOBS_TABLE}
      ${where}
      ${orderByClause}, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const result = await neonHelper.query(query, [...params, limit, offset])
    if (!result || result.length === 0) return []

    return result
      .map(mapRowToJob)
      .filter(job => filterJobByRegion(job, queryParams));
  } catch (e) {
    console.warn('Neon database read error:', e?.message || e)
    return []
  }
}

// 获取符合条件的记录总数
async function countJobsFromNeon(queryParams = {}) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  try {
    const { where, params } = buildWhereClause(queryParams)
    const query = `SELECT COUNT(*) FROM ${JOBS_TABLE} ${where}`
    console.log('countJobsFromNeon query:', query, params)

    const result = await neonHelper.query(query, params)
    if (!result || result.length === 0) return 0

    return parseInt(result[0].count, 10)
  } catch (e) {
    console.warn('Neon database count error:', e?.message || e)
    return 0
  }
}

/**
 * 获取带匹配分数的岗位列表
 * @param {string} userId - 用户ID
 * @param {object} queryParams - 查询参数
 * @param {object} pagination - 分页参数
 * @returns {object} 包含岗位列表、总数和分页信息
 */
async function getJobsWithMatchScores(userId, queryParams = {}, pagination = {}) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  try {
    const { where, params } = buildWhereClause(queryParams)
    const { page = 1, limit = 50 } = pagination
    const offset = (page - 1) * limit

    // 构建排序子句
    let orderByClause = ''

    if (queryParams.sortBy === 'recent') {
      // 最新排序：严格按发布时间倒序
      orderByClause = `ORDER BY j.published_at DESC`
    } else {
      // 默认/相关排序：按照岗位匹配度展示
      orderByClause = `ORDER BY COALESCE(ujm.match_score, 0) DESC, j.published_at DESC`
    }

    console.log(`[getJobsWithMatchScores] sortBy=${queryParams.sortBy}, orderByClause=${orderByClause.replace(/\s+/g, ' ').trim()}`)

    // 构建带匹配分数的查询语句
    const query = `
      SELECT 
        j.*,
        (SELECT website FROM trusted_companies tc WHERE tc.company_id = j.company_id) as trusted_website,
        (SELECT logo FROM trusted_companies tc WHERE tc.company_id = j.company_id) as trusted_logo,
        CASE WHEN COALESCE(ujm.match_score, 0) >= 30 THEN COALESCE(ujm.match_score, 0) ELSE 0 END as match_score,
        COALESCE(ujm.calculated_at, j.published_at) as match_updated_at
      FROM ${JOBS_TABLE} j
      LEFT JOIN user_job_matches ujm ON j.job_id = ujm.job_id AND ujm.user_id = $${params.length + 1}
      ${where}
      ${orderByClause}
      LIMIT $${params.length + 2} OFFSET $${params.length + 3}
    `

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) 
      FROM ${JOBS_TABLE} j
      LEFT JOIN user_job_matches ujm ON j.job_id = ujm.job_id AND ujm.user_id = $1
      ${where}
    `

    const [jobsResult, countResult] = await Promise.all([
      neonHelper.query(query, [...params, userId, limit, offset]),
      neonHelper.query(countQuery, [userId, ...params])
    ])

    const jobs = jobsResult || []
    const total = countResult && countResult.length > 0 ? parseInt(countResult[0].count, 10) : 0
    const totalPages = Math.ceil(total / limit)

    // 转换数据格式并应用区域过滤
    const formattedJobs = jobs
      .map(mapRowToJob)
      .filter(job => filterJobByRegion(job, queryParams))

    return {
      jobs: formattedJobs,
      total,
      totalPages
    }
  } catch (e) {
    console.error('获取带匹配分数的岗位列表失败:', e?.message || e)
    throw e
  }
}

/**
 * 自动判断岗位的区域类型 (优化版)
 * @param {string} location - 岗位地点
 * @returns {'domestic' | 'overseas' | 'both'}
 * 
 * 优化内容:
 * 1. 香港/澳门/台湾视为"国内可申"(大中华区)
 * 2. APAC/UTC+8等亚太时区视为"国内可申"(对国内申请者友好)
 * 3. 更精确的关键词匹配
 * 4. 默认值从 'overseas' 改为 'both'(更保守)
 */
function classifyRegion(location) {
  const loc = (location || '').toLowerCase().trim()

  // 空地点默认为both
  if (!loc) return 'both'

  // 全球不限地点关键词 (纯净版)
  const globalKeywords = [
    'anywhere', 'everywhere', 'worldwide', 'global',
    'remote', 'work from anywhere', 'wfa',
    '不限地点', '全球', '任意地点'
  ]

  // 中国大陆关键词
  const mainlandKeywords = [
    'china', '中国', 'cn', 'chinese', 'mainland china', 'prc',
    'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou',
    'chengdu', '北京', '上海', '深圳', '广州', '杭州',
    '成都', '重庆', '南京', '武汉', '西安', '苏州',
    '天津', '大连', '青岛', '厦门', '珠海', '佛山',
    '宁波', '无锡', '长沙', '郑州', '济南', '哈尔滨',
    '沈阳', '福州', '石家庄', '合肥', '昆明', '兰州'
  ]

  // 大中华区(港澳台) - 视为国内可申
  const greaterChinaKeywords = [
    'hong kong', 'hongkong', 'hk', '香港',
    'macau', 'macao', '澳门',
    'taiwan', 'taipei', '台湾', '台北', '高雄'
  ]

  // 亚太时区 - 对国内申请者友好
  const apacKeywords = [
    'apac', 'asia pacific', 'east asia', 'southeast asia',
    'utc+8', 'gmt+8', 'cst', 'asia/shanghai', 'asia/hong_kong',
    '亚太', '东亚', '东南亚'
  ]

  // 明确的海外关键词
  const overseasKeywords = [
    // 北美
    'usa', 'united states', 'america', 'san francisco', 'new york',
    'seattle', 'boston', 'austin', 'los angeles', 'silicon valley', 'bay area',
    'portland', 'denver', 'chicago', 'atlanta', 'miami', 'dallas',
    'canada', 'toronto', 'vancouver', 'montreal', 'calgary',
    'mexico', 'mexico city',
    'hawaii', 'honolulu', // 夏威夷

    // 欧洲
    'europe', 'emea', 'united kingdom', 'england', 'london',
    'germany', 'berlin', 'munich', 'frankfurt', 'hamburg',
    'france', 'paris', 'lyon',
    'spain', 'madrid', 'barcelona',
    'italy', 'rome', 'milan',
    'netherlands', 'amsterdam', 'rotterdam',
    'belgium', 'brussels',
    'sweden', 'stockholm',
    'norway', 'oslo',
    'denmark', 'copenhagen',
    'finland', 'helsinki',
    'poland', 'warsaw',
    'czech', 'prague',
    'ireland', 'dublin',
    'switzerland', 'zurich', 'geneva',
    'austria', 'vienna',
    'portugal', 'lisbon',

    // 大洋洲
    'australia', 'sydney', 'melbourne', 'brisbane', 'perth',
    'new zealand', 'auckland', 'wellington',

    // 亚洲其他(明确海外)
    'japan', 'tokyo', 'osaka', 'kyoto',
    'korea', 'south korea', 'seoul', 'busan',
    'singapore', // 新加坡虽在亚太,但作为独立国家视为海外
    'malaysia', 'kuala lumpur',
    'indonesia', 'jakarta', 'bali',
    'thailand', 'bangkok',
    'vietnam', 'hanoi', 'ho chi minh',
    'philippines', 'manila',
    'india', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune',
    'pakistan', 'karachi',
    'bangladesh', 'dhaka',
    'sri lanka', 'colombo',
    'kuwait', // 科威特

    // 中东
    'uae', 'dubai', 'abu dhabi',
    'saudi', 'riyadh', 'jeddah',
    'qatar', 'doha',
    'israel', 'tel aviv', 'jerusalem',
    'turkey', 'istanbul', 'ankara',

    // 南美
    'brazil', 'sao paulo', 'rio de janeiro',
    'argentina', 'buenos aires',
    'chile', 'santiago',
    'colombia', 'bogota',
    'peru', 'lima',
    'latam', 'latin america',

    // 其他
    'russia', 'moscow', 'st petersburg',
    'africa', 'egypt', 'cairo', 'south africa', 'cape town'
  ]

  // 短关键词（需要单词边界匹配）
  const shortOverseasKeywords = ['us', 'uk', 'eu']

  // 检查逻辑
  let isOverseas = overseasKeywords.some(k => loc.includes(k))

  // 检查短关键词 (单词边界)
  if (!isOverseas) {
    isOverseas = shortOverseasKeywords.some(k => {
      const regex = new RegExp(`\\b${k}\\b`, 'i')
      return regex.test(loc)
    })
  }

  const isMainland = mainlandKeywords.some(k => loc.includes(k))
  const isGreaterChina = greaterChinaKeywords.some(k => loc.includes(k))
  const isAPAC = apacKeywords.some(k => loc.includes(k))
  const isGlobal = globalKeywords.some(k => loc.includes(k))

  // 优先级分类逻辑

  // 1. 中国/大中华区 - 绝对的国内可申
  // 如果同时包含海外关键词(如 "US or China")，则视为 'both'，否则 'domestic'
  if (isMainland || isGreaterChina) {
    // 如果同时有海外或全球属性，标记为 both 以便在海外列表也能看到
    if (isOverseas || isGlobal || isAPAC) {
      return 'both'
    }
    return 'domestic'
  }

  // 2. APAC/亚太时区 - 用户指定归为"中国可申"
  // 通常亚太也包含海外属性，所以归为 'both' (既在中国可申列表，也在海外列表)
  if (isAPAC) {
    return 'both'
  }

  // 3. 明确的海外地点 - 归为海外
  // 必须放在 APAC 之后，因为 APAC 即使包含 Singapore (Overseas) 也要算作可申
  // 必须放在 Global 之前，因为 "Remote - US" 应该算 Overseas 而不是 Both
  if (isOverseas) {
    return 'overseas'
  }

  // 4. Global/Remote/Anywhere - 归为"中国可申" (Both)
  if (isGlobal) {
    return 'both'
  }

  // 默认: 如果完全无法判断，归为海外
  return 'overseas'
}

async function writeJobsToNeon(jobs, mode = 'replace', skipFilter = false, client = null) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  // Filter recent jobs if replacing, but for upsert we might want to keep what we are given?
  // Let's keep the logic consistent: we only store recent jobs generally.
  // 🔧 FIX: 允许通过 skipFilter 跳过日期过滤（用于翻译更新等场景）
  const recent = skipFilter ? jobs : filterRecentJobs(jobs, RETAIN_DAYS)
  const unique = removeDuplicates(recent)

  const executeWrite = async (sql) => {
      // 仅在 replace 模式下清空表
      if (mode === 'replace') {
        await sql.query(`DELETE FROM ${JOBS_TABLE}`)
      }

      // 批量插入/更新数据
      for (const job of unique) {
        // 自动分类区域 (强制重新计算以确保准确性)
        job.region = classifyRegion(job.location)

        // 自动设置 sourceType
        if (!job.sourceType) {
          if (job.canRefer) {
            job.sourceType = 'club-referral'
          } else if (job.isTrusted) {
            job.sourceType = 'official' // or 'curated'
          } else {
            job.sourceType = 'third-party'
          }
        }

        // 强制逻辑：如果是第三方来源，不显示可信/内推标签
        if (job.sourceType === 'third-party' || job.sourceType === 'rss') {
          job.sourceType = 'third-party';
          job.isTrusted = false;
          job.canRefer = false;
        }

        // Ensure ID exists
        if (!job.id) {
            const title = (job.title || '').toLowerCase().trim()
            const company = (job.company || '').toLowerCase().trim()
            const url = (job.url || '').toLowerCase().trim()
            const dedupKey = generateDedupKey({ title, company, url })
            job.id = dedupKey.startsWith('id:') ? dedupKey.slice(3) : dedupKey.replace('hash:', '')
        }

        // Ensure defaults
        const status = job.status || 'active'
        const source = job.source || 'unknown'
        const publishedAt = job.publishedAt || new Date().toISOString()

        await sql.query(`
          INSERT INTO ${JOBS_TABLE} (
            job_id, title, company, location, description, url, published_at,
            source, category, salary, job_type, experience_level, tags, 
            requirements, benefits, is_remote, status, region, translations,
            is_translated, translated_at, company_id, source_type, is_trusted, can_refer, is_featured, is_manually_edited,
            risk_rating, haigoo_comment, hidden_fields, industry,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
          ON CONFLICT (job_id) DO UPDATE SET
            title = EXCLUDED.title,
            company = EXCLUDED.company,
            location = EXCLUDED.location,
            description = EXCLUDED.description,
            url = EXCLUDED.url,
            published_at = EXCLUDED.published_at,
            source = EXCLUDED.source,
            category = EXCLUDED.category,
            salary = EXCLUDED.salary,
            job_type = EXCLUDED.job_type,
            experience_level = EXCLUDED.experience_level,
            tags = EXCLUDED.tags,
            requirements = EXCLUDED.requirements,
            benefits = EXCLUDED.benefits,
            is_remote = EXCLUDED.is_remote,
            status = EXCLUDED.status,
            region = EXCLUDED.region,
            translations = EXCLUDED.translations,
            is_translated = EXCLUDED.is_translated,
            translated_at = EXCLUDED.translated_at,
            company_id = EXCLUDED.company_id,
            source_type = EXCLUDED.source_type,
            is_trusted = EXCLUDED.is_trusted,
            can_refer = EXCLUDED.can_refer,
            is_featured = EXCLUDED.is_featured,
            is_manually_edited = EXCLUDED.is_manually_edited,
            risk_rating = EXCLUDED.risk_rating,
            haigoo_comment = EXCLUDED.haigoo_comment,
            hidden_fields = EXCLUDED.hidden_fields,
            industry = EXCLUDED.industry,
            updated_at = EXCLUDED.updated_at
        `, [
          job.id,
          job.title,
          job.company,
          job.location,
          job.description,
          job.url,
          publishedAt,
          source,
          job.category,
          job.salary,
          job.jobType,
          job.experienceLevel,
          JSON.stringify(job.tags || []),
          JSON.stringify(job.requirements || []),
          JSON.stringify(job.benefits || []),
          job.isRemote,
          status,
          job.region,
          job.translations ? JSON.stringify(job.translations) : null,
          job.isTranslated,
          job.translatedAt,
          job.companyId,
          job.sourceType,
          job.isTrusted,
          job.canRefer,
          job.isFeatured,
          job.isManuallyEdited || false,
          job.riskRating ? JSON.stringify(job.riskRating) : null,
          job.haigooComment,
          job.hiddenFields ? JSON.stringify(job.hiddenFields) : null,
          job.industry,
          job.createdAt || new Date().toISOString(),
          job.updatedAt || new Date().toISOString()
        ])
      }
  }

  try {
    // 使用事务批量写入
    if (client) {
        await executeWrite(client)
    } else {
        await neonHelper.transaction(async (sql) => {
            await executeWrite(sql)
        })
    }
    
    console.log(`✅ 成功写入 ${unique.length} 个岗位到 Neon 数据库 (mode: ${mode})`)
    return unique
  } catch (e) {
    console.error('Neon database write error:', e?.message || e)
    throw e
  }
}

// Export Neon specific functions for granular control (pagination etc)
export {
  readJobsFromNeon,
  countJobsFromNeon,
  writeJobsToNeon,
  NEON_CONFIGURED
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 缓存策略：CDN 缓存 60 秒，后台更新 5 分钟
  // 这能显著减少 Fast Origin Transfer 消耗
  if (req.method === 'GET') {
    const { action } = req.query || {}
    // Re-enable cache for public lists and stats
    // Exclude 'jobs_with_match_score' as it returns personalized data
    if (action !== 'jobs_with_match_score') {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    } else {
      // Personalized data should not be cached publicly
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    }
  }

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
        let activeJobsCount = 0
        let todayJobsCount = 0

        try {
          // 直接从数据库统计
          if (NEON_CONFIGURED) {
            // 获取总职位数
            jobsCount = await neonHelper.count(JOBS_TABLE) || 0

            // 估算存储大小（每个岗位约1KB）
            storageSize = jobsCount * 1024

            // 获取最新更新时间
            const latestJob = await neonHelper.select(JOBS_TABLE, {}, {
              orderBy: 'updated_at',
              orderDirection: 'DESC',
              limit: 1
            })
            if (latestJob && latestJob.length > 0) {
              lastSync = latestJob[0].updated_at
            }

            // 获取活跃职位数
            activeJobsCount = await neonHelper.count(JOBS_TABLE, { status: 'active' }) || 0

            // 获取今日新增职位数（大于等于今天零点）
            const today = new Date().toISOString().split('T')[0]
            const todayJobsResult = await neonHelper.query(`SELECT COUNT(*) FROM ${JOBS_TABLE} WHERE created_at >= $1`, [`${today}T00:00:00.000Z`])
            todayJobsCount = parseInt(todayJobsResult?.[0]?.count || 0, 10)

            provider = 'neon'
          }

          return res.status(200).json({
            provider,
            totalJobs: jobsCount,
            storageSize,
            lastSync,
            activeJobs: activeJobsCount || 0,
            recentlyAdded: todayJobsCount || 0,
          })
        } catch (e) {
          console.error('[processed-jobs] Stats error:', e)
          return res.status(500).json({ error: 'Failed to fetch stats' })
        }
      }

      // Jobs with match score Action
      if (action === 'jobs_with_match_score') {
        // 验证用户身份
        const token = extractToken(req);

        if (!token) {
          return res.status(401).json({ success: false, error: '未提供认证令牌' });
        }

        const payload = verifyToken(token);

        if (!payload || !payload.userId) {
          return res.status(401).json({ success: false, error: '认证令牌无效或已过期' });
        }

        const userId = payload.userId;

        const {
          page = '1',
          pageSize = '50',
          search,
          location,
          type,
          experienceLevel,
          isRemote,
          company,
          category,
          region,
          regionType, // Fix: Extract regionType from query
          tags,
          dateFrom,
          dateTo,
          sourceType, // Added sourceType support for match score endpoint
          sortBy // Add sortBy to ensure it's passed to the handler
        } = req.query || {}

        const pageNum = Number(page) || 1
        const pageSizeNum = Number(pageSize) || 50

        try {
          // 构建查询参数
          const queryParams = {
            search,
            location,
            type,
            experienceLevel,
            isRemote,
            company,
            category,
            region,
            regionType, // Fix: Pass regionType to queryParams
            tags,
            dateFrom,
            dateTo,
            sourceType, // Pass sourceType to buildWhereClause
            sortBy // Pass sortBy to buildWhereClause
          }

          // 获取带匹配分数的岗位列表
          const result = await getJobsWithMatchScores(userId, queryParams, { page: pageNum, limit: pageSizeNum })

          return res.status(200).json({
            jobs: result.jobs,
            total: result.total,
            page: pageNum,
            pageSize,
            totalPages: result.totalPages
          })
        } catch (e) {
          console.error('[processed-jobs] Jobs with match score error:', e)
          return res.status(500).json({ error: 'Failed to fetch jobs with match scores' })
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
        region,
        regionType,
        sourceType,
        isTrusted,
        isNew,
        sortBy // Add sortBy
      } = req.query || {}

      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 50

      let items = []
      let total = 0
      let totalPages = 0
      let provider = 'neon'
      const startTime = Date.now()

      // 只使用 Neon 数据库，直接在数据库层面进行过滤和分页
      if (NEON_CONFIGURED) {
        try {
          // 构建查询参数
          const queryParams = {
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
            id,
            region,
            sourceType, // Added sourceType
            regionType,
            isTrusted,
            isNew,
            sortBy // Pass sortBy
          }

          // 获取总记录数（用于分页）
          total = await countJobsFromNeon(queryParams)
          totalPages = Math.ceil(total / pageSize)

          // 获取分页数据
          items = await readJobsFromNeon(queryParams, { page: pageNum, limit: pageSize })
          provider = 'neon'

          console.log(`[processed-jobs] GET: Neon database query success, ${items.length} items (total: ${total}), ${Date.now() - startTime}ms`)
        } catch (e) {
          console.error(`[processed-jobs] GET: Neon database query CRITICAL FAILURE:`, e)
          console.error(`[processed-jobs] Stack trace:`, e?.stack)
          console.error(`[processed-jobs] Query params that caused failure:`, JSON.stringify({
            source, category, status, dateFrom, dateTo, company, isRemote,
            search, location, type, id, region, sourceType, regionType, isTrusted, isNew
          }))

          items = []
          total = 0
          totalPages = 0
          provider = 'neon-error'
        }
      } else {
        items = []
        total = 0
        totalPages = 0
        provider = 'neon-not-configured'
      }

      // Member-only fields masking logic
      let isMember = false;
      const token = extractToken(req);
      if (token) {
        try {
          // Simple verification. For critical security, verify against DB (check expiration).
          // But since member status is in DB, we should ideally fetch user.
          // However, fetching user for every list request might be heavy.
          // We can rely on verifyToken returning a valid payload, but we need memberStatus.
          // The payload might NOT have memberStatus if it's old.
          // So let's fetch user for now to be safe, or check if we can optimize.
          // Optimization: Assume most list views are public. If token exists, we check.
          const payload = verifyToken(token);
          if (payload && payload.userId) {
            // We need to import getUserById. But user-helper is not imported here?
            // It is not imported at top level. Let's dynamic import or move it.
            // Wait, this file imports neonHelper. Let's just query users table directly for speed.
            const userRes = await neonHelper.query(
              'SELECT member_status, member_expire_at, roles FROM users WHERE user_id = $1',
              [payload.userId]
            );
            if (userRes && userRes.length > 0) {
              const u = userRes[0];

              // Check membership status (support both new and legacy fields)
              const isActive = u.member_status === 'active';
              const isLegacyVip = u.membership_level === 'club_go' || u.membership_level === 'goo_plus' || u.membership_level === 'vip' || u.membership_level === 'svip';

              if (isActive) {
                // If active, check expiration if it exists
                if (u.member_expire_at) {
                  isMember = new Date(u.member_expire_at) > new Date();
                } else {
                  // Active but no expiration = Lifetime/Permanent
                  isMember = true;
                }
              } else if (isLegacyVip) {
                // Fallback to legacy check
                isMember = true;
              }
            }
          }
        } catch (e) {
          console.warn('[processed-jobs] Token check failed:', e);
        }
      }

      // Mask fields if not member
      if (!isMember && items.length > 0) {
        items = items.map(job => {
          // Mask or remove sensitive member-only fields
          const { riskRating, haigooComment, hiddenFields, ...rest } = job;
          return {
            ...rest,
            // We can return null or a "locked" indicator if needed by frontend, 
            // or just omit them. Frontend checks for existence.
            // Let's keep them undefined/null to save bandwidth.
          };
        });
      }

      // DEBUG: Log first few jobs to check for companyId
      if (items.length > 0) {
        const debugJobs = items.slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          companyId: j.companyId,
          sourceType: j.sourceType,
          hasRiskRating: !!j.riskRating // Check if it survived masking (should be false for non-members)
        }))
        console.log('[processed-jobs] Debug Response Jobs (isMember=' + isMember + '):', JSON.stringify(debugJobs))
      }

      // 缓存策略：CDN 缓存 60 秒，后台更新 5 分钟
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
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
          canRefer: !!j.canRefer,
          isFeatured: !!j.isFeatured,
          riskRating: j.riskRating || null,
          haigooComment: j.haigooComment || null,
          hiddenFields: j.hiddenFields || null
        }
      })

      // 尝试匹配受信任公司
      try {
        const companies = await getAllCompanies()

        // 通用名称标准化函数：移除常见后缀、特殊字符，转小写
        const normalizeName = (name) => {
          if (!name) return '';
          let norm = name.toLowerCase();
          // 移除常见后缀 (需注意顺序，长词在前)
          const suffixes = [
            ' corporation', ' incorporated', ' limited', ' company', ' group', ' holdings', ' technologies', ' technology', ' solutions', ' systems', ' services', ' labs', ' software', ' interactive', ' entertainment', ' studios', ' networks', ' media',
            ' corp', ' inc', ' ltd', ' llc', ' co', ' gmbh', ' s.a.', ' s.a.r.l.', ' b.v.', ' plc'
          ];
          for (const suffix of suffixes) {
            if (norm.endsWith(suffix) || norm.endsWith(suffix + '.')) {
              norm = norm.substring(0, norm.lastIndexOf(suffix));
            }
          }
          // 移除所有非字母数字字符
          return norm.replace(/[^a-z0-9]/g, '');
        };

        // 从URL中提取主域名 (e.g. "https://www.alphasights.com/..." -> "alphasights.com")
        const extractDomain = (url) => {
          if (!url) return '';
          try {
            const hostname = new URL(url).hostname;
            return hostname.replace(/^www\./, '');
          } catch (e) {
            return '';
          }
        };

        for (const job of normalized) {
          const jobNameNorm = normalizeName(job.company);
          const jobUrl = job.url || job.sourceUrl || job.companyWebsite;
          const jobDomain = extractDomain(jobUrl);

          let c = null;

          // 1. 优先尝试域名匹配 (最准确)
          if (jobDomain) {
            c = companies.find(tc => {
              const tcDomain = extractDomain(tc.website);
              // 检查主域名是否包含 (处理 subdomain 或 ats)
              // e.g. job: apply.workable.com/alphasights -> domain: apply.workable.com (匹配失败)
              // e.g. job: careers.alphasights.com -> domain: careers.alphasights.com (匹配成功: endsWith alphasights.com)
              if (tcDomain && (jobDomain === tcDomain || jobDomain.endsWith('.' + tcDomain))) {
                return true;
              }
              // 检查 ATS 链接特征
              // 如果 trusted company 的 careersPage 是 ATS 链接，尝试匹配
              if (tc.careersPage) {
                // 简单检查: 如果 jobUrl 包含 trusted company 的名字 (normalized) 且来自于常见的 ATS 域名
                // 这是一个启发式规则，可能需要更严格
                const atsDomains = ['workable.com', 'greenhouse.io', 'lever.co', 'ashbyhq.com', 'bamboohr.com'];
                const isAts = atsDomains.some(d => jobDomain.endsWith(d));
                const tcNameNorm = normalizeName(tc.name);
                if (isAts && tcNameNorm && tcNameNorm.length > 3 && jobUrl.toLowerCase().includes(tcNameNorm)) {
                  return true;
                }
              }
              return false;
            });
          }

          // 2. 如果域名没匹配上，尝试通用名称匹配
          if (!c && jobNameNorm) {
            c = companies.find(tc => {
              const tcNameNorm = normalizeName(tc.name);
              if (!tcNameNorm) return false;

              // 完全匹配
              if (tcNameNorm === jobNameNorm) return true;

              // 包含匹配 (仅当名字足够长且非通用词)
              // 防止 "Go" 匹配 "Google", "App" 匹配 "Apple"
              if (jobNameNorm.length > 3 && tcNameNorm.length > 3) {
                // 必须是单词边界或者是包含关系
                return tcNameNorm.includes(jobNameNorm) || jobNameNorm.includes(tcNameNorm);
              }
              return false;
            });
          }

          if (c) {
            let changed = false
            if (!job.companyWebsite && c.website) { job.companyWebsite = c.website; changed = true }
            if (!job.companyDescription && c.description) { job.companyDescription = c.description; changed = true }
            if (c.id) job.companyId = c.id
            job.isTrusted = true

            // 🆕 Fix source type for trusted companies
            // If matched with a trusted company, mark as official unless it's explicitly a referral
            if (job.sourceType !== 'referral' && job.sourceType !== 'club-referral') {
              job.sourceType = 'official';
            }
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
          // Pass the mode explicitly! writeJobsToNeon defaults to 'replace' if undefined.
          // If mode is 'append', we already merged it into toWrite, so we can use 'replace' (dangerous?) 
          // or 'upsert' (safer if toWrite only has new stuff).
          // But wait, the 'append' block above reads ALL existing jobs, merges them, and sets toWrite = all.
          // In that case, 'replace' is actually correct for 'append' mode as implemented (overwrite all with new full list).
          // BUT, if mode is 'upsert' (which we will use for single job updates), we do NOT run the 'append' block.
          // In that case toWrite = normalized (just the new jobs).
          // So we MUST pass 'upsert' (or anything != 'replace') to writeJobsToNeon.

          // Let's pass the mode correctly.
          // Note: writeJobsToNeon internally only checks `if (mode === 'replace') delete`.
          // So passing 'upsert', 'update', 'append' (if we didn't do the full read) works as upsert.
          // For the 'append' case above: we set provider='neon' and toWrite=all. 
          // If we pass 'replace', it deletes all and inserts all. This is fine.
          // If we pass 'append', it doesn't delete, just inserts. Since we have ALL jobs in toWrite, 
          // we would get key conflicts -> ON CONFLICT UPDATE. This is also fine and maybe safer (no gap).
          // But sticking to the intention:
          saved = await writeJobsToNeon(toWrite, mode === 'replace' ? 'replace' : 'upsert');
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

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'Missing id' })

      if (NEON_CONFIGURED) {
        try {
          await neonHelper.query(`DELETE FROM ${JOBS_TABLE} WHERE job_id = $1`, [id])
          console.log(`[processed-jobs] DELETE: Deleted job ${id}`)
          return res.status(200).json({ success: true })
        } catch (e) {
          console.error('[processed-jobs] DELETE error:', e)
          return res.status(500).json({ error: e.message })
        }
      }
      return res.status(503).json({ error: 'Database not configured' })
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
