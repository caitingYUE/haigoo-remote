import { analyzeJobContent } from '../../lib/bailian-parser.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { expandSearchTerms } from '../server-utils/keyword-expander.js'
import { validateJob } from '../../lib/utils/job-validator.js'
import { extractSalary, extractLocation, classifyRegion, CATEGORY_REVERSE_MAP } from '../services/classification-service.js'
import { systemSettingsService } from '../services/system-settings-service.js'
import { sendEmail } from '../../server-utils/email-service.js'
import { generateDedupKey } from '../utils/job-utils.js'


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
let configureTranslation = null
try {
  // 使用动态导入来兼容ES模块环境中的CommonJS模块
  const translationService = await import('../services/translation-service.cjs')
  translateJobs = translationService.default?.translateJobs || translationService.translateJobs
  configureTranslation = translationService.default?.configure || translationService.configure
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

// Location Keywords for Whitelist Validation & Region Classification
const GLOBAL_KEYWORDS = [
  'anywhere', 'everywhere', 'worldwide', 'global',
  'remote', 'work from anywhere', 'wfa', 'distributed',
  '不限地点', '全球', '任意地点', '远程', '在家办公'
]

const MAINLAND_KEYWORDS = [
  'china', '中国', 'cn', 'chinese', 'mainland china', 'prc',
  'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou',
  'chengdu', '北京', '上海', '深圳', '广州', '杭州',
  '成都', '重庆', '南京', '武汉', '西安', '苏州',
  '天津', '大连', '青岛', '厦门', '珠海', '佛山',
  '宁波', '无锡', '长沙', '郑州', '济南', '哈尔滨',
  '沈阳', '福州', '石家庄', '合肥', '昆明', '兰州'
]

const GREATER_CHINA_KEYWORDS = [
  'hong kong', 'hongkong', 'hk', '香港',
  'macau', 'macao', '澳门',
  'taiwan', 'taipei', '台湾', '台北', '高雄'
]

const APAC_KEYWORDS = [
  'apac', 'asia pacific', 'east asia', 'southeast asia',
  'utc+8', 'gmt+8', 'cst', 'asia/shanghai', 'asia/hong_kong',
  '亚太', '东亚', '东南亚'
]

const OVERSEAS_KEYWORDS = [
  // North America
  'usa', 'united states', 'america', 'san francisco', 'new york',
  'seattle', 'boston', 'austin', 'los angeles', 'silicon valley', 'bay area',
  'portland', 'denver', 'chicago', 'atlanta', 'miami', 'dallas',
  'canada', 'toronto', 'vancouver', 'montreal', 'calgary',
  'mexico', 'mexico city',
  'hawaii', 'honolulu',
  'north america', '美国', '加拿大', '北美',

  // Europe
  'europe', 'emea', 'united kingdom', 'england', 'london', 'uk', 'britain',
  'germany', 'berlin', 'munich', 'frankfurt', 'hamburg', 'deutschland',
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
  'estonia', 'latvia', 'lithuania',
  'ukraine', 'romania', 'bulgaria', 'greece', 'athens',
  '英国', '德国', '法国', '西班牙', '意大利', '荷兰', '瑞典', '挪威', '芬兰', '波兰', '爱尔兰', '瑞士', '奥地利', '葡萄牙', '欧洲',

  // Oceania
  'australia', 'sydney', 'melbourne', 'brisbane', 'perth',
  'new zealand', 'auckland', 'wellington',
  '澳洲', '澳大利亚', '新西兰',

  // Asia (Overseas)
  'japan', 'tokyo', 'osaka', 'kyoto',
  'korea', 'south korea', 'seoul', 'busan',
  'singapore',
  'malaysia', 'kuala lumpur',
  'indonesia', 'jakarta', 'bali',
  'thailand', 'bangkok',
  'vietnam', 'hanoi', 'ho chi minh',
  'philippines', 'manila',
  'india', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune',
  'pakistan', 'karachi',
  'bangladesh', 'dhaka',
  'sri lanka', 'colombo',
  'kuwait',
  '日本', '东京', '韩国', '首尔', '新加坡', '马来西亚', '印尼', '泰国', '越南', '菲律宾', '印度',

  // Middle East
  'uae', 'dubai', 'abu dhabi',
  'saudi', 'riyadh', 'jeddah',
  'qatar', 'doha',
  'israel', 'tel aviv', 'jerusalem',
  'turkey', 'istanbul', 'ankara',
  '阿联酋', '迪拜', '沙特', '卡塔尔', '以色列', '土耳其',

  // South America
  'brazil', 'sao paulo', 'rio de janeiro',
  'argentina', 'buenos aires',
  'chile', 'santiago',
  'colombia', 'bogota',
  'peru', 'lima',
  'uruguay', 'montevideo',
  'latam', 'latin america',
  '巴西', '阿根廷', '智利', '哥伦比亚', '秘鲁', '乌拉圭', '南美',

  // Others
  'russia', 'moscow', 'st petersburg',
  'africa', 'egypt', 'cairo', 'south africa', 'cape town', 'nigeria', 'kenya',
  '俄罗斯', '非洲', '埃及', '南非'
]

// Combined whitelist for validation
const ALL_VALID_LOCATIONS = [
  ...GLOBAL_KEYWORDS,
  ...MAINLAND_KEYWORDS,
  ...GREATER_CHINA_KEYWORDS,
  ...APAC_KEYWORDS,
  ...OVERSEAS_KEYWORDS
];

// Helper: Check if text contains a valid location
function isValidLocation(text) {
  if (!text || text.length < 2) return false;
  const lower = text.toLowerCase().trim();

  // 1. Direct match or inclusion of known location
  // We use word boundary check for short words (<= 3 chars) to avoid false positives like "us" in "status"
  // BUT: For Chinese/non-ASCII keywords, \b doesn't work well.

  return ALL_VALID_LOCATIONS.some(keyword => {
    // Check if keyword contains non-ASCII characters (likely Chinese/Japanese/Korean)
    const isNonAscii = /[^\x00-\x7F]/.test(keyword);

    if (!isNonAscii && keyword.length <= 3) {
      // Strict word boundary for short English keywords (uk, us, cn, hk, etc.)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lower);
    } else {
      // For longer keywords OR non-ASCII keywords, simple inclusion is safe
      return lower.includes(keyword);
    }
  });
}

// Helper: Extract location from text
function extractLocationFromText(text) {
  if (!text) return null

  // Strip HTML tags for regex matching
  const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

  // 0. Check for "Title - Location" pattern (common in job titles)
  // e.g., "Software Engineer - Uruguay (Remote)", "DevOps - UK"
  const titleLocMatch = cleanText.match(/-\s*([A-Za-z\u4e00-\u9fa5\s]+)(?:\s*[\(\（].*?[\)\）])?$/);
  if (titleLocMatch && titleLocMatch[1]) {
    const potentialLoc = titleLocMatch[1].trim();
    if (isValidLocation(potentialLoc)) {
      return potentialLoc;
    }
  }

  // 1. Check for locations in parentheses/brackets e.g., "Software Engineer (UK)", "[China]"
  // Improved to handle Chinese brackets and cleaner matching
  const parenMatches = cleanText.match(/[\(\[\{\（\【](.*?)[\)\]\}\）\】]/g)
  if (parenMatches) {
    for (const match of parenMatches) {
      const content = match.slice(1, -1).trim()
      if (content.length < 50 && isValidLocation(content)) {
        return content
      }
    }
  }

  // 2. Common "Location:" pattern in description
  // Improved regex to stop at more delimiters
  const locPattern = /(?:Location|Based in|Remote form|Remote in|地点|工作地点|城市):\s*([^\n\.<,;]+)/i
  const locMatch = cleanText.match(locPattern)
  if (locMatch && locMatch[1]) {
    const content = locMatch[1].trim();
    if (content.length < 50 && isValidLocation(content)) {
      return content;
    }
  }

  // 3. Remote variations
  if (/\b(remote|wfh|work from home|distributed|anywhere|远程|在家办公)\b/i.test(cleanText)) {
    // Try to find if it's "Remote - [Region]"
    const remoteRegion = cleanText.match(/(?:remote|远程)\s*[-–—]\s*([A-Za-z\u4e00-\u9fa5\s]+)/i);
    if (remoteRegion && remoteRegion[1]) {
      const content = remoteRegion[1].trim();
      if (isValidLocation(content)) {
        return `Remote - ${content}`;
      }
    }
    return 'Remote';
  }

  return null
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
  if (queryParams.ids) {
    conditions.push(`${JOBS_TABLE}.job_id = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(queryParams.ids)
    paramIndex++
  } else if (queryParams.id) {
    conditions.push(`${JOBS_TABLE}.job_id = $${paramIndex}`)
    params.push(queryParams.id)
    paramIndex++
  }

  if (queryParams.source) {
    if (queryParams.source === 'special:official') {
      conditions.push(`(${JOBS_TABLE}.is_trusted = true OR ${JOBS_TABLE}.source_type = 'official')`)
    } else if (queryParams.source === 'special:manual') {
      conditions.push(`(${JOBS_TABLE}.source = 'manual' OR ${JOBS_TABLE}.is_manually_edited = true)`)
    } else {
      conditions.push(`${JOBS_TABLE}.source ILIKE $${paramIndex}`)
      params.push(queryParams.source)
      paramIndex++
    }
  }

  // 默认过滤掉 RSS/Third-party 来源的岗位
  // 保留内推 (can_refer) 和 企业官网/认证企业 (is_trusted)
  // 除非是管理员 (isAdmin) 或者是指向特定ID的查询
  // ⚠️ 2026-01-05 User Request: 取消后端隐藏逻辑，展示所有来源的数据
  /*
  if (!queryParams.isAdmin && !queryParams.id) {
    conditions.push('(can_refer = true OR is_trusted = true)');
    // User Requirement: Only show jobs applicable for Chinese candidates (Domestic + Global/Both)
    // Exclude 'overseas' region which usually implies "Overseas Location Required"
    conditions.push("region IN ('domestic', 'global', 'both')");
  }
  */

  // ⚠️ 2026-01-05 User Request: New Job Approval Workflow
  // Only show approved jobs for public view, unless querying by ID (detail page might need to show pending jobs to admin, but public detail page?)
  // Actually, public detail page should also hide unapproved jobs.
  // Admin view (queryParams.isAdmin) should show all.
  // ⚠️ 2026-01-07 Fix: Allow NULL (legacy/pending) to be visible to avoid empty list for non-login users
  if (!queryParams.isAdmin && !queryParams.id) {
    conditions.push(`(${JOBS_TABLE}.is_approved = true)`);
  } else if (!queryParams.isAdmin && queryParams.id) {
    // For single job detail view by public
    conditions.push(`(${JOBS_TABLE}.is_approved = true)`);
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
      sourceConditions.push(`${JOBS_TABLE}.can_refer = true`);
    }

    if (hasTrusted) {
      // Trusted Company but NOT Referral
      sourceConditions.push(`((${JOBS_TABLE}.is_trusted = true OR ${JOBS_TABLE}.source_type = 'trusted') AND ${JOBS_TABLE}.can_refer IS NOT TRUE)`);
    }

    if (hasOfficial) {
      // Official Website Jobs: is_trusted = true AND source_type = 'official' (if distinct) or just is_trusted
      // Based on UI logic: job.isTrusted but not canRefer is "Official Website"
      // Actually, UI logic says: 
      // job.canRefer -> Referral
      // job.isTrusted -> Official/Trusted (Orange badge)
      // So "Trusted" and "Official" might be the same in current DB schema unless differentiated by source_type
      // Let's assume 'official' maps to the Orange badge logic: is_trusted=true, can_refer=false
      sourceConditions.push(`((${JOBS_TABLE}.is_trusted = true OR ${JOBS_TABLE}.source_type = 'trusted') AND ${JOBS_TABLE}.can_refer IS NOT TRUE)`);
    }

    if (hasRss) {
      // RSS/Third-party means NOT can_refer AND NOT is_trusted (handling NULLs safely)
      sourceConditions.push(`((${JOBS_TABLE}.can_refer IS NOT TRUE) AND (${JOBS_TABLE}.is_trusted IS NOT TRUE))`);
    }

    if (sourceConditions.length > 0) {
      conditions.push(`(${sourceConditions.join(' OR ')})`);
    }
  }

  // Removed duplicate single-value category check that broke multi-select
  
  // Handle search (support both 'search' and 'searchQuery')
  const searchTerm = queryParams.search || queryParams.searchQuery
  if (searchTerm) {
    // 1. Expand search terms (Bilingual support)
    const expandedTerms = expandSearchTerms(searchTerm)

    // 2. Define fields to search (Added industry, source_type)
    const searchFields = [
      'title', 'company', 'description', 'location',
      'category', 'job_type', 'tags::text',
      'industry', 'source_type'
    ]

    // 3. Build OR conditions for all terms
    const orConditions = []

    expandedTerms.forEach(term => {
      const fieldChecks = searchFields.map(field => `${JOBS_TABLE}.${field} ILIKE $${paramIndex}`)
      orConditions.push(`(${fieldChecks.join(' OR ')})`)
      params.push(`%${term}%`)
      paramIndex++
    })

    conditions.push(`(${orConditions.join(' OR ')})`)
  }

  // Handle category (multi-select)
  if (queryParams.category && typeof queryParams.category === 'string' && queryParams.category.trim() !== '') {
    // 处理分类：允许部分匹配，以兼容 "测试" vs "测试/QA" 这种差异
    const categories = queryParams.category.split(',')
    const catChecks = []
    
    for (const cat of categories) {
      // 1. 精确匹配 (Case Insensitive)
      // 2. 包含匹配 (e.g. "测试" 匹配 "测试/QA")
      // 3. 反向映射匹配 (e.g. "后端开发" 匹配 "Backend")
      
      const subConditions = []

      // A. 原始值模糊匹配
      subConditions.push(`${JOBS_TABLE}.category ILIKE $${paramIndex}`)
      params.push(`%${cat}%`)
      paramIndex++

      // B. 拆分匹配 (针对 "测试/QA")
      const subParts = cat.split(/[/\\]/)
      if (subParts.length > 1) {
         subParts.forEach(p => {
             subConditions.push(`${JOBS_TABLE}.category ILIKE $${paramIndex}`)
             params.push(`%${p}%`)
             paramIndex++
         })
      }

      // C. 英文关键词反向匹配
      // 如果用户选了 "后端开发"，我们也去匹配 "Backend", "Java" 等
      const englishKeywords = CATEGORY_REVERSE_MAP[cat] || []
      englishKeywords.forEach(kw => {
          subConditions.push(`${JOBS_TABLE}.category ILIKE $${paramIndex}`) // Match category field
          params.push(`%${kw}%`)
          paramIndex++
          
          // Optional: Also search title if category is missing/other?
          // No, filter should strict to category field to avoid noise.
          // BUT: If data is raw, category might be empty.
          // Let's stick to category column first.
      })

      catChecks.push(`(${subConditions.join(' OR ')})`)
    }
    
    if (catChecks.length > 0) {
        conditions.push(`(${catChecks.join(' OR ')})`)
    }
  }

  // Handle location (multi-select / fuzzy)
  if (queryParams.location) {
    const locs = queryParams.location.split(',');
    const locChecks = [];
    for(const loc of locs) {
       locChecks.push(`${JOBS_TABLE}.location ILIKE $${paramIndex}`);
       params.push(`%${loc}%`);
       paramIndex++;
    }
    if (locChecks.length > 0) {
       conditions.push(`(${locChecks.join(' OR ')})`);
    }
  }

  // Handle timezone (multi-select)
  if (queryParams.timezone) {
    conditions.push(`${JOBS_TABLE}.timezone = ANY(string_to_array($${paramIndex}, ','))`)
    params.push(queryParams.timezone)
    paramIndex++
  }

  // Handle status
  if (queryParams.status) {
    conditions.push(`${JOBS_TABLE}.status = $${paramIndex}`)
    params.push(queryParams.status)
    paramIndex++
  }

  // Handle company (fuzzy)
  if (queryParams.company) {
    conditions.push(`${JOBS_TABLE}.company ILIKE $${paramIndex}`)
    params.push(`%${queryParams.company}%`)
    paramIndex++
  }

  // Handle companyId (exact match)
  if (queryParams.companyId) {
    conditions.push(`${JOBS_TABLE}.company_id = $${paramIndex}`)
    params.push(queryParams.companyId)
    paramIndex++
  }

  // Handle isRemote
  if (typeof queryParams.isRemote !== 'undefined') {
    conditions.push(`${JOBS_TABLE}.is_remote = $${paramIndex}`)
    params.push(queryParams.isRemote === 'true' || queryParams.isRemote === true)
    paramIndex++
  }

  // Handle isFeatured
  // Improved logic: Only handle explicit true/false values. Ignore undefined, null, "", etc.
  if (queryParams.isFeatured === 'true' || queryParams.isFeatured === true) {
    conditions.push(`${JOBS_TABLE}.is_featured = true`)
  } else if (queryParams.isFeatured === 'false' || queryParams.isFeatured === false) {
    conditions.push(`(${JOBS_TABLE}.is_featured IS NOT TRUE)`)
  }

  // Handle canRefer
  if (typeof queryParams.canRefer !== 'undefined') {
    conditions.push(`${JOBS_TABLE}.can_refer = $${paramIndex}`)
    params.push(queryParams.canRefer === 'true' || queryParams.canRefer === true)
    paramIndex++
  }

  // Handle isTrusted
  if (typeof queryParams.isTrusted !== 'undefined') {
    conditions.push(`${JOBS_TABLE}.is_trusted = $${paramIndex}`)
    params.push(queryParams.isTrusted === 'true' || queryParams.isTrusted === true)
    paramIndex++
  }

  // Handle isNew (published within last 3 days)
  if (queryParams.isNew === 'true' || queryParams.isNew === true) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    conditions.push(`${JOBS_TABLE}.published_at >= $${paramIndex}`)
    params.push(threeDaysAgo)
    paramIndex++
  }

  // Handle region (domestic/overseas/global)
  // Logic consolidated into regionType handling below


  // Handle jobType (multi-select) - maps to job_type column
  // Frontend sends 'jobType' or 'type'
  const jobType = queryParams.jobType || queryParams.type
  if (jobType) {
    const types = jobType.split(',')
    const typeConditions = []
    
    for (const t of types) {
        const cleanType = t.toLowerCase().trim()
        const subConditions = []
        
        // Basic match
        subConditions.push(`LOWER(${JOBS_TABLE}.job_type) = $${paramIndex}`)
        params.push(cleanType)
        paramIndex++

        // Expanded mapping for common types
        if (cleanType === 'internship' || cleanType === 'intern') {
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%intern%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%实习%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%trainee%'); paramIndex++;
        }
        else if (cleanType === 'full-time' || cleanType === 'full_time') {
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%full%time%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%全职%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%permanent%'); paramIndex++;
        }
        else if (cleanType === 'part-time' || cleanType === 'part_time') {
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%part%time%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%兼职%'); paramIndex++;
        }
        else if (cleanType === 'contract') {
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%contract%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%合同%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%project%'); paramIndex++;
        }
        else if (cleanType === 'freelance') {
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%freelance%'); paramIndex++;
            subConditions.push(`${JOBS_TABLE}.job_type ILIKE $${paramIndex}`); params.push('%自由%'); paramIndex++;
        }

        typeConditions.push(`(${subConditions.join(' OR ')})`)
    }

    if (typeConditions.length > 0) {
        conditions.push(`(${typeConditions.join(' OR ')})`)
    }
  }

  // Handle experienceLevel (multi-select) - maps to experience_level column
  if (queryParams.experienceLevel) {
    conditions.push(`LOWER(${JOBS_TABLE}.experience_level) = ANY(string_to_array(LOWER($${paramIndex}), ','))`)
    params.push(queryParams.experienceLevel)
    paramIndex++
  }

  // Handle industry (multi-select) - now maps to industry column
  if (queryParams.industry) {
    const industries = queryParams.industry.split(',')
    const indChecks = []

    for (const ind of industries) {
        // 1. Exact match (case-insensitive) - Check BOTH jobs and trusted_companies
        // We use tc alias for trusted_companies, which must be joined in all queries using this where clause
        indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`)
        params.push(ind)
        paramIndex++

        // 2. Mapping for English/Fuzzy matching
        if (ind === '人工智能') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%AI%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Artificial Intelligence%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Machine Learning%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Technology%'); paramIndex++; // Fallback for general tech if labeled AI
        }
        else if (ind === 'Web3/区块链') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Web3%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Blockchain%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Crypto%'); paramIndex++;
        }
        else if (ind === '互联网/软件') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Software%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Internet%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Technology%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%SaaS%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%IT%'); paramIndex++;
        }
        else if (ind === '金融/Fintech') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Finance%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Fintech%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Banking%'); paramIndex++;
             indChecks.push(`tags ?| ARRAY['Fintech', 'Finance', 'Banking', '金融', '银行']`);
        }
        else if (ind === '电子商务') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%E-commerce%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Retail%'); paramIndex++;
        }
        else if (ind === '游戏/娱乐') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Game%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Gaming%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Entertainment%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Media%'); paramIndex++;
        }
        else if (ind === '企业服务/SaaS') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Enterprise%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%SaaS%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%B2B%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Business%'); paramIndex++;
        }
        else if (ind === '硬件/物联网') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Hardware%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%IoT%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Semiconductor%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Electronics%'); paramIndex++;
        }
        else if (ind === '大健康/医疗') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Health%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Medical%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Bio%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Pharma%'); paramIndex++;
        }
        else if (ind === '教育') {
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Education%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%EdTech%'); paramIndex++;
             indChecks.push(`(${JOBS_TABLE}.industry ILIKE $${paramIndex} OR tc.industry ILIKE $${paramIndex})`); params.push('%Training%'); paramIndex++;
        }
    }

    if (indChecks.length > 0) {
        conditions.push(`(${indChecks.join(' OR ')})`)
    }
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
    conditions.push(`is_manually_edited = $${paramIndex}`)
    params.push(queryParams.isManuallyEdited === 'true' || queryParams.isManuallyEdited === true)
    paramIndex++
  }

  // Handle isApproved
  if (typeof queryParams.isApproved !== 'undefined') {
    const val = queryParams.isApproved
    // Handle 'true', 'false', true, false
    const boolVal = val === 'true' || val === true
    
    if (boolVal) {
      conditions.push(`is_approved = true`)
    } else {
      // "Pending/Not Approved" means NOT true (includes False and Null)
      conditions.push(`(is_approved IS NOT TRUE)`)
    }
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


  // Handle excludeIds (to prevent loops in cron jobs)
  if (queryParams.excludeIds) {
    const ids = Array.isArray(queryParams.excludeIds) ? queryParams.excludeIds : queryParams.excludeIds.split(',')
    if (ids.length > 0) {
      // Use NOT IN
      // Depending on the number of IDs, this might be slow, but for a cron batch (e.g. up to a few thousands), it's okay.
      // Neon/Postgres handles ANY properly.
      conditions.push(`job_id != ALL($${paramIndex})`)
      params.push(ids)
      paramIndex++
    }
  }

  // Handle isTranslated
  if (typeof queryParams.isTranslated !== 'undefined') {
    const val = queryParams.isTranslated
    const boolVal = val === 'true' || val === true

    // Use IS TRUE / IS NOT TRUE to handle NULLs correctly
    // IS NOT TRUE matches both FALSE and NULL
    if (boolVal) {
      conditions.push(`is_translated IS TRUE`)
    } else {
      // Simple and robust: Only explicitly untranslated jobs
      // We rely on the "cleanFakeTranslations" mechanism to reset "fake" translations to false/null
      conditions.push(`(is_translated IS NOT TRUE OR translations IS NULL)`)
    }
  }

  // Handle Region (supports multiple regions: domestic,overseas)
  const regionParam = queryParams.regionType || queryParams.region
  if (regionParam) {
    const regions = String(regionParam).toLowerCase().split(',')
    const regionConditions = []

    if (regions.includes('domestic')) {
      // 国内：region 为 'domestic', 'global' 或 'both'
      // User Requirement: Global remote jobs are applicable for domestic candidates
      regionConditions.push(`region IN ('domestic', 'global', 'both')`)
    }

    if (regions.includes('overseas')) {
      // 海外：region 为 'overseas', 'global' 或 'both'
      regionConditions.push(`region IN ('overseas', 'global', 'both')`)
    }

    // Fallback/Direct Match if not using keywords
    if (regionConditions.length === 0) {
        // If it's a specific region like 'global' or 'unclassified' passed directly
        if (!regions.includes('domestic') && !regions.includes('overseas')) {
             const safeRegions = regions.map(r => `'${r.replace(/'/g, "''")}'`).join(',')
             regionConditions.push(`region IN (${safeRegions})`)
        }
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
    type: row.job_type, // Frontend expects 'type'
    jobType: row.job_type, // Keep for backward compatibility
    experienceLevel: row.experience_level,
    tags: safeJsonParse(row.tags, []),
    requirements: safeJsonParse(row.requirements, []),
    benefits: safeJsonParse(row.benefits, []),
    isRemote: row.is_remote,
    status: row.status,
    region: effectiveRegion,
    timezone: row.timezone,
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
    companyIndustry: row.industry || row.trusted_industry, // Map database 'industry' column to 'companyIndustry' (fallback to trusted company industry)
    hiringEmail: row.trusted_hiring_email,
    emailType: row.trusted_email_type,
    industry: row.industry || row.trusted_industry,
    isManuallyEdited: row.is_manually_edited,
    // Member-only fields (may be masked later)
    riskRating: safeJsonParse(row.risk_rating, null),
    haigooComment: row.haigoo_comment,
    hiddenFields: safeJsonParse(row.hidden_fields, null),
    isApproved: row.is_approved
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

// Helper: Calculate aggregations based on current query
async function getAggregations(where, params) {
  if (!NEON_CONFIGURED) return {}

  // Define aggregation targets
  // Note: We use the same WHERE clause, so facets reflect the *current filtered set* (Narrowing)
  // This matches user request: "If only 4 jobs, don't show irrelevant options"
  const targets = [
    { key: 'category', column: 'category' },
    { key: 'industry', column: 'industry' },
    { key: 'jobType', column: 'job_type' },
    { key: 'location', column: 'location', limit: 20 }, // Top 20 locations
    { key: 'regionType', column: 'region' },
    { key: 'timezone', column: 'timezone' }
  ]

  const results = {}
  
  // Debug log
  console.log('[getAggregations] Start for where:', where);

  await Promise.all(targets.map(async ({ key, column, limit }) => {
    try {
      const limitClause = limit ? `ORDER BY count DESC LIMIT ${limit}` : 'ORDER BY count DESC'
      
      let sql = ''
      
      // Special handling for industry aggregation to join trusted_companies
      if (key === 'industry') {
         sql = `
           SELECT COALESCE(jobs.industry, tc.industry) as value, COUNT(*) as count 
           FROM ${JOBS_TABLE} jobs
           LEFT JOIN trusted_companies tc ON jobs.company_id = tc.company_id
           ${where} 
           GROUP BY COALESCE(jobs.industry, tc.industry)
           ${limitClause}
         `
      } else {
          // Standard aggregation (Now includes JOIN to support tc.industry filtering)
          sql = `
            SELECT ${column} as value, COUNT(*) as count 
            FROM ${JOBS_TABLE} 
            LEFT JOIN trusted_companies tc ON ${JOBS_TABLE}.company_id = tc.company_id
            ${where} 
            GROUP BY ${column} 
            ${limitClause}
          `
      }
      
      // console.log(`[getAggregations] Executing for ${key}:`, sql, params);
      const rows = await neonHelper.query(sql, params)
      
      results[key] = rows.map(r => ({
        value: r.value || 'Unspecified',
        count: parseInt(r.count, 10)
      })).filter(r => r.value !== 'Unspecified') // Optional: hide unspecified?
    } catch (e) {
      console.warn(`[processed-jobs] Aggregation failed for ${key}:`, e.message)
      results[key] = []
    }
  }))

  // console.log('[getAggregations] Results:', JSON.stringify(results));
  return results
}

async function readJobsFromNeon(queryParams = {}, pagination = {}) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  try {
    const { where, params } = buildWhereClause(queryParams)
    console.log('[getJobsWithMatchScores] queryParams:', JSON.stringify(queryParams), 'where:', where, 'params:', params)
    const { page = 1, limit = 50 } = pagination
    const offset = (page - 1) * limit

    let orderByClause = ''

    // Search Relevance Sorting
    if (queryParams.search) {
      // Add search term to params for sorting usage
      params.push(`%${queryParams.search}%`)
      const termIndex = params.length

      orderByClause = `ORDER BY (
        CASE WHEN ${JOBS_TABLE}.title ILIKE $${termIndex} THEN 10 ELSE 0 END +
        CASE WHEN ${JOBS_TABLE}.description ILIKE $${termIndex} THEN 1 ELSE 0 END
      ) DESC, ${JOBS_TABLE}.published_at DESC`
    }
    // Recent Sorting
    else if (queryParams.sortBy === 'recent' || queryParams.sortBy === 'published_at_desc') {
      orderByClause = `ORDER BY ${JOBS_TABLE}.published_at DESC`
    }
    else if (queryParams.sortBy === 'published_at_asc') {
      orderByClause = `ORDER BY ${JOBS_TABLE}.published_at ASC`
    }
    // Default / "Relevance" (Business Logic)
    else {
      orderByClause = `ORDER BY 
        CASE WHEN ${JOBS_TABLE}.is_featured = true THEN 1 ELSE 0 END DESC,
        CASE WHEN ${JOBS_TABLE}.can_refer = true THEN 1 ELSE 0 END DESC,
        CASE WHEN ${JOBS_TABLE}.is_trusted = true THEN 1 ELSE 0 END DESC,
        ${JOBS_TABLE}.published_at DESC`
    }

    const query = `
      SELECT ${JOBS_TABLE}.*, 
        tc.website as trusted_website,
        tc.logo as trusted_logo,
        tc.industry as trusted_industry,
        tc.hiring_email as trusted_hiring_email,
        tc.email_type as trusted_email_type
      FROM ${JOBS_TABLE}
      LEFT JOIN trusted_companies tc ON ${JOBS_TABLE}.company_id = tc.company_id
      ${where}
      ${orderByClause}, ${JOBS_TABLE}.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const result = await neonHelper.query(query, [...params, limit, offset])
    if (!result || result.length === 0) return []

    const mappedJobs = result
      .map(mapRowToJob)
      // .filter(job => filterJobByRegion(job, queryParams)); // 优化：SQL已经过滤了，JS层不需要再次过滤，否则会破坏分页

    // 如果是最新排序，不进行打散，保持时间顺序
    if (queryParams.sortBy === 'recent' || queryParams.sortBy === 'published_at_desc' || queryParams.sortBy === 'published_at_asc') {
      return mappedJobs
    }

    return scatterJobs(mappedJobs)
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
    const query = `SELECT COUNT(*) FROM ${JOBS_TABLE} LEFT JOIN trusted_companies tc ON ${JOBS_TABLE}.company_id = tc.company_id ${where}`
    console.log('countJobsFromNeon query:', query, params)

    const result = await neonHelper.query(query, params)
    if (!result || result.length === 0) return 0

    const count = parseInt(result[0].count, 10)
    if (queryParams.companyId) {
      console.log(`[processed-jobs] countJobsFromNeon for companyId ${queryParams.companyId}: ${count}`)
    }
    return count
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

    // Debug Log
    console.log('[getJobsWithMatchScores] Input queryParams:', JSON.stringify(queryParams));
    console.log('[getJobsWithMatchScores] Generated SQL where:', where);
    console.log('[getJobsWithMatchScores] Generated SQL params:', params);

    // 构建排序子句
    let orderByClause = ''

    // 优化：如果包含搜索词或特定过滤，使用相关性排序；否则默认按时间排序
    // 防止无筛选条件时 ORDER BY match_score 导致全表扫描性能问题
    const hasSearch = !!queryParams.search;
    const hasSpecificFilter = !!queryParams.company || !!queryParams.isTrusted;

    if (queryParams.sortBy === 'recent' || queryParams.sortBy === 'published_at_desc') {
      // 最新排序：严格按发布时间倒序
      orderByClause = `ORDER BY ${JOBS_TABLE}.published_at DESC`
    } else if (queryParams.sortBy === 'published_at_asc') {
      orderByClause = `ORDER BY ${JOBS_TABLE}.published_at ASC`
    } else {
      // 默认推荐排序：
      // 1. 如果有搜索词，按相关性（DB层已处理）
      // 2. 如果无搜索词，按 匹配分(AI) > 岗位追踪 > 置顶 > 内推 > 时间

      // 注意：ujm.match_score 已经包含了 AI 评分
      // 我们可以进一步联合其他信号，比如是否在追踪列表（这里暂未关联追踪表，但可以根据 match_score >= 80 视为高相关）

      // 优化逻辑：即使无搜索词，只要是已登录用户（match_score > 0），就优先展示高分岗位
      // 对于未登录用户（match_score 全为 0），回退到 Feature/Trust/Time 排序

      orderByClause = `ORDER BY 
        CASE WHEN COALESCE(ujm.match_score, 0) >= 80 THEN 1 ELSE 0 END DESC, 
        CASE WHEN ${JOBS_TABLE}.is_featured = true THEN 1 ELSE 0 END DESC,               
        COALESCE(ujm.match_score, 0) DESC,                                   
        ${JOBS_TABLE}.published_at DESC`
    }

    console.log(`[getJobsWithMatchScores] sortBy=${queryParams.sortBy}, orderByClause=${orderByClause.replace(/\s+/g, ' ').trim()}`)

    // Add is_approved filter for match score queries too
    // ⚠️ 2026-01-07 Fix: Removed redundant filter, buildWhereClause already handles it
    // const isApprovedFilter = queryParams.isAdmin ? '' : 'AND j.is_approved = true'

    // 构建带匹配分数的查询语句
    const query = `
      SELECT 
        ${JOBS_TABLE}.*,
        tc.website as trusted_website,
        tc.logo as trusted_logo,
        tc.industry as trusted_industry,
        CASE WHEN COALESCE(ujm.match_score, 0) >= 30 THEN COALESCE(ujm.match_score, 0) ELSE 0 END as match_score,
        COALESCE(ujm.calculated_at, ${JOBS_TABLE}.published_at) as match_updated_at
      FROM ${JOBS_TABLE}
      LEFT JOIN trusted_companies tc ON ${JOBS_TABLE}.company_id = tc.company_id
      LEFT JOIN user_job_matches ujm ON ${JOBS_TABLE}.job_id = ujm.job_id AND ujm.user_id = $${params.length + 1}
      ${where}
      ${orderByClause}
      LIMIT $${params.length + 2} OFFSET $${params.length + 3}
    `

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) 
      FROM ${JOBS_TABLE}
      LEFT JOIN trusted_companies tc ON ${JOBS_TABLE}.company_id = tc.company_id
      LEFT JOIN user_job_matches ujm ON ${JOBS_TABLE}.job_id = ujm.job_id AND ujm.user_id = $1
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
    // .filter(job => filterJobByRegion(job, queryParams)) // 优化：SQL已经过滤了，JS层不需要再次过滤，否则会破坏分页

    // 获取聚合数据 (Facets) - Use the same query params
    const { where: aggWhere, params: aggParams } = buildWhereClause(queryParams)
    const aggregations = await getAggregations(aggWhere, aggParams)

    // 如果是最新排序，不进行打散，保持时间顺序
    const finalJobs = (queryParams.sortBy === 'recent' || queryParams.sortBy === 'published_at_desc' || queryParams.sortBy === 'published_at_asc') ? formattedJobs : scatterJobs(formattedJobs)

    return {
      jobs: finalJobs,
      total,
      totalPages,
      aggregations
    }
  } catch (e) {
    console.error('获取带匹配分数的岗位列表失败:', e?.message || e)
    throw e
  }
}



/**
 * 岗位打散算法 (Scatter Jobs) - V2 Enhanced
 * 优化展示体验，避免同一企业/类型岗位过于集中
 * 
 * 2025-12-27 V2 修复:
 * - 修复 backlog 末尾追加导致同企业聚集的问题
 * - 实现交错式 backlog 插入，确保同企业岗位均匀分布
 */
function scatterJobs(jobs) {
  if (!jobs || jobs.length <= 2) return jobs

  const result = []
  const backlog = [] // 暂存因冲突被推迟的岗位

  // 辅助函数：检查是否可以插入到当前位置（只检查连续性）
  const canInsertBasic = (job, currentList) => {
    if (currentList.length === 0) return true
    const last = currentList[currentList.length - 1]
    // 不能连续2个是同一家公司
    return last.company !== job.company
  }

  // 辅助函数：完整检查是否可以插入（包括窗口限制）
  const canInsertFull = (job, currentList) => {
    if (!canInsertBasic(job, currentList)) return false

    // 窗口检查：最近16个岗位内，同一企业不超过1个
    const windowSize = 16
    const recentJobs = currentList.slice(-windowSize)
    const sameCompanyCount = recentJobs.filter(j => j.company === job.company).length
    if (sameCompanyCount >= 1) return false

    // 类型多样性（较短窗口）
    const shortWindow = recentJobs.slice(-8)
    if (shortWindow.length >= 4) {
      const sameTypeCount = shortWindow.filter(j => j.jobType === job.jobType).length
      if (sameTypeCount >= 3) return false
    }

    return true
  }

  // 第一轮：主遍历，尽可能按规则插入
  for (const job of jobs) {
    // 尝试从 backlog 中找一个可以插入的
    let backlogInserted = false
    for (let i = 0; i < backlog.length; i++) {
      if (canInsertFull(backlog[i], result)) {
        result.push(backlog[i])
        backlog.splice(i, 1)
        backlogInserted = true
        break
      }
    }

    // 尝试插入当前 job
    if (canInsertFull(job, result)) {
      result.push(job)
    } else {
      backlog.push(job)
    }
  }

  // 第二轮：智能 backlog 刷入 - 交错插入不同公司的岗位
  // 按公司分组 backlog
  const companyGroups = new Map()
  for (const job of backlog) {
    const key = job.company || 'Unknown'
    if (!companyGroups.has(key)) {
      companyGroups.set(key, [])
    }
    companyGroups.get(key).push(job)
  }

  // 轮询式插入：从每个公司轮流取一个岗位
  const companies = Array.from(companyGroups.keys())
  let remaining = backlog.length
  let roundRobinIndex = 0
  let stuckCounter = 0 // 防止死循环

  while (remaining > 0 && stuckCounter < remaining * 2) {
    const company = companies[roundRobinIndex % companies.length]
    const queue = companyGroups.get(company)

    if (queue && queue.length > 0) {
      const job = queue[0]

      // 尝试按基本规则插入（只检查连续性，放松窗口限制）
      if (canInsertBasic(job, result)) {
        result.push(queue.shift())
        remaining--
        stuckCounter = 0 // 成功插入，重置计数器
      } else {
        stuckCounter++
      }
    }

    roundRobinIndex++

    // 移除空队列的公司
    if (queue && queue.length === 0) {
      companies.splice(companies.indexOf(company), 1)
      if (companies.length === 0) break
    }
  }

  // 最后兜底：如果还有剩余（理论上不应该），强制追加
  for (const company of companyGroups.keys()) {
    const queue = companyGroups.get(company)
    if (queue && queue.length > 0) {
      result.push(...queue)
    }
  }

  return result
}



// ... existing imports ...

// ...

// ...

async function writeJobsToNeon(jobs, mode = 'replace', skipFilter = false, client = null) {
  if (!NEON_CONFIGURED) throw new Error('Neon database not configured')

  // Validation Phase: Filter out low-quality or invalid jobs before processing
  const validJobs = jobs.filter(job => {
    // Determine temporary sourceType for validation (will be finalized later)
    let type = job.sourceType;
    if (!type) {
      if (job.canRefer) type = 'club-referral';
      else if (job.isTrusted) type = 'official';
      else type = 'third-party';
    }

    // Strict validation
    const result = validateJob(job, type);

    if (!result.isValid) {
      // Optional: Log discarded jobs responsibly (avoid flooding logs)
      // console.log(`[JobValidation] Dropped ${job.company} - ${job.title}: ${result.reason}`);
      return false;
    }
    return true;
  });

  if (jobs.length > validJobs.length) {
    console.log(`[JobValidation] Filtered out ${jobs.length - validJobs.length} invalid jobs.`);
  }

  // Filter recent jobs if replacing, but for upsert we might want to keep what we are given?
  // Let's keep the logic consistent: we only store recent jobs generally.
  // 🔧 FIX: 允许通过 skipFilter 跳过日期过滤（用于翻译更新等场景）
  const recent = skipFilter ? validJobs : filterRecentJobs(validJobs, RETAIN_DAYS)
  const unique = removeDuplicates(recent)

  const executeWrite = async (sql) => {
    // 仅在 replace 模式下清空表
    if (mode === 'replace') {
      await sql.query(`DELETE FROM ${JOBS_TABLE}`)
    }

    // 批量插入/更新数据
    for (const job of unique) {
      // 自动分类区域 (强制重新计算以确保准确性)
      // FIX: 仅当区域未提供时才重新计算，允许外部传入已保存的区域值（如同步逻辑）
      if (!job.region) {
        job.region = classifyRegion(job.location)
      }

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
      const timezone = job.timezone || null // Fix: Define timezone variable

      await sql.query(`
          INSERT INTO ${JOBS_TABLE} (
            job_id, title, company, location, description, url, published_at,
            source, category, salary, job_type, experience_level, tags, 
            requirements, benefits, is_remote, status, region, timezone, translations,
            is_translated, translated_at, company_id, source_type, is_trusted, can_refer, is_featured, is_manually_edited, is_approved,
            risk_rating, haigoo_comment, hidden_fields, industry,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
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
            timezone = EXCLUDED.timezone,
            translations = CASE 
              WHEN jobs.description IS DISTINCT FROM EXCLUDED.description THEN NULL 
              ELSE COALESCE(EXCLUDED.translations, jobs.translations) 
            END,
            is_translated = CASE 
              WHEN jobs.description IS DISTINCT FROM EXCLUDED.description THEN FALSE 
              ELSE COALESCE(EXCLUDED.is_translated, jobs.is_translated) 
            END,
            translated_at = CASE 
              WHEN jobs.description IS DISTINCT FROM EXCLUDED.description THEN NULL 
              ELSE COALESCE(EXCLUDED.translated_at, jobs.translated_at) 
            END,
            company_id = EXCLUDED.company_id,
            source_type = EXCLUDED.source_type,
            is_trusted = EXCLUDED.is_trusted,
            can_refer = EXCLUDED.can_refer,
            is_featured = EXCLUDED.is_featured,
            is_manually_edited = EXCLUDED.is_manually_edited,
            is_approved = EXCLUDED.is_approved,
            risk_rating = EXCLUDED.risk_rating,
            haigoo_comment = EXCLUDED.haigoo_comment,
            hidden_fields = EXCLUDED.hidden_fields,
            industry = EXCLUDED.industry,
            updated_at = EXCLUDED.updated_at
        `, [
        job.id,
        truncateString(job.title, FIELD_LIMITS.title),
        truncateString(job.company, FIELD_LIMITS.company),
        truncateString(job.location, FIELD_LIMITS.location),
        truncateString(job.description, FIELD_LIMITS.description),
        truncateString(job.url, FIELD_LIMITS.url),
        publishedAt,
        truncateString(source, FIELD_LIMITS.source),
        truncateString(job.category, FIELD_LIMITS.category),
        truncateString(job.salary, FIELD_LIMITS.salary),
        truncateString(job.jobType, FIELD_LIMITS.jobType),
        truncateString(job.experienceLevel, FIELD_LIMITS.experienceLevel),
        JSON.stringify(job.tags || []),
        JSON.stringify(job.requirements || []),
        JSON.stringify(job.benefits || []),
        job.isRemote,
        status,
        truncateString(job.region, FIELD_LIMITS.region),
        timezone, // Fix: Use variable
        job.translations ? JSON.stringify(job.translations) : null,
        job.isTranslated,
        job.translatedAt,
        job.companyId,
        truncateString(job.sourceType, 100), // Manual limit for sourceType
        job.isTrusted,
        job.canRefer,
        job.isFeatured,
        job.isManuallyEdited || false,
        job.isApproved, // New param
        job.riskRating ? JSON.stringify(job.riskRating) : null,
        job.haigooComment,
        job.hiddenFields ? JSON.stringify(job.hiddenFields) : null,
        truncateString(job.industry, 100), // Manual limit for industry
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
      // P0 Debug: Disable Cache temporarily to debug aggregation issue
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      // res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
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

      // Featured Home Action (New Logic)
      if (action === 'featured_home') {
        if (!NEON_CONFIGURED) return res.status(503).json({ error: 'Database not configured' })

        try {
          // SQL Logic:
          // 1. Strict Filter: is_featured = true (Manual Override)
          // 2. Basic Safety: active & approved
          // 3. Date Filter: Published within last 30 days (User Request)
          // 4. Sort: Newest first
          // 5. Limit: Fetch more (100) to allow for diversity filtering

          const query = `
            SELECT 
              j.*,
              tc.website as trusted_website,
              tc.logo as trusted_logo,
              tc.industry as trusted_industry
            FROM ${JOBS_TABLE} j
            LEFT JOIN trusted_companies tc ON j.company_id = tc.company_id
            WHERE j.status = 'active'
              AND j.is_approved = true
              AND j.is_featured = true
              AND j.published_at > NOW() - INTERVAL '30 days'
            ORDER BY j.published_at DESC
            LIMIT 100
          `

          const result = await neonHelper.query(query)
          const allJobs = (result || []).map(mapRowToJob)
          
          // Apply Diversity Logic: Max 2 jobs per company
          // User Request: "Same company max 2 times in 6 jobs"
          const companyCounts = {}
          const selectedJobs = []
          
          for (const job of allJobs) {
            if (selectedJobs.length >= 6) break
            
            // Prefer companyId, fallback to company name
            const companyKey = job.companyId || job.company
            const count = companyCounts[companyKey] || 0
            
            if (count < 2) {
              selectedJobs.push(job)
              companyCounts[companyKey] = count + 1
            }
          }
          
          // Result is already sorted by publishedAt DESC because we iterated in that order
          const jobs = selectedJobs

          // Cache header for 5 minutes
          res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
          return res.status(200).json({ jobs })
        } catch (e) {
          console.error('[processed-jobs] Featured home error:', e)
          return res.status(500).json({ error: 'Failed to fetch featured jobs' })
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
        const isAdmin = payload.role === 'admin' || payload.isAdmin;

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
          timezone, // Fix: Extract timezone from query
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
            sortBy, // Pass sortBy to buildWhereClause
            // ⚠️ 2026-01-07 User Request: Strict separation of Member vs Admin
            // Member users (C-side) should NOT see unapproved content or bypass filters,
            // even if the account happens to have admin role (e.g. testing account).
            // Admin permissions are strictly for the backend admin panel.
            isAdmin: false 
          }

          // 获取带匹配分数的岗位列表
          const result = await getJobsWithMatchScores(userId, queryParams, { page: pageNum, limit: pageSizeNum })

          return res.status(200).json({
            jobs: result.jobs,
            total: result.total,
            page: pageNum,
            pageSize,
            totalPages: result.totalPages,
            aggregations: result.aggregations
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
        jobType,
        experienceLevel,
        salary,
        tags,
        skills,
        id,
        region,
        regionType,
        sourceType,
        timezone,
        isTrusted,
        isNew,
        sortBy, // Add sortBy
        isAdmin, // Add isAdmin
        isApproved, // Add isApproved
        industry, // Add industry
        isFeatured, // Add isFeatured
        companyId, // Add companyId
        skipAggregations // Add skipAggregations
      } = req.query || {}

      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 50

      // Auth & Role Check
      let isMember = false
      let effectiveIsAdmin = isAdmin === 'true' || isAdmin === true

      const token = extractToken(req)
      if (token) {
        const payload = verifyToken(token)
        if (payload) {
          // Logged in users are considered members (for now)
          isMember = true
          // Check admin role from token
          if (payload.role === 'admin' || payload.isAdmin) {
            effectiveIsAdmin = true
          }
        }
      }

      // Admin implies member access
      if (effectiveIsAdmin) isMember = true

      // Debug Auth
      // console.log(`[processed-jobs] Auth Check: token=${!!token}, isMember=${isMember}, effectiveIsAdmin=${effectiveIsAdmin}, query.companyId=${companyId}`);

      let items = []
      let total = 0
      let totalPages = 0
      let aggregations = {}
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
            jobType, // Pass jobType
            experienceLevel, // Pass experienceLevel
            salary, // Pass salary
            id,
            region,
            sourceType, // Added sourceType
            regionType,
            isTrusted,
            isNew,
            sortBy, // Pass sortBy
            isAdmin: effectiveIsAdmin, // Pass isAdmin
            isApproved, // Pass isApproved
            industry, // Pass industry
            isFeatured, // Pass isFeatured
            companyId // Pass companyId
          }

          // 获取总记录数（用于分页）
          // Optimization: Skip count if skipAggregations is true (for company detail page)
          if (skipAggregations !== 'true') {
            total = await countJobsFromNeon(queryParams)
            totalPages = Math.ceil(total / pageSize)
          } else {
             // Mock total for detail page to avoid breaking frontend logic if any
             total = 100 
             totalPages = 1
          }

          // 获取分页数据
          items = await readJobsFromNeon(queryParams, { page: pageNum, limit: pageSize })
          
          // 获取聚合数据 (Facets)
          if (skipAggregations !== 'true') {
            const { where: aggWhere, params: aggParams } = buildWhereClause(queryParams)
            aggregations = await getAggregations(aggWhere, aggParams)
          }

          provider = 'neon'

          console.log(`[processed-jobs] GET: Neon database query success, ${items.length} items (total: ${total}), ${Date.now() - startTime}ms`)
        } catch (e) {
          console.error(`[processed-jobs] GET: Neon database query CRITICAL FAILURE:`, e)
          console.error(`[processed-jobs] Stack trace:`, e?.stack)
          console.error(`[processed-jobs] Query params that caused failure:`, JSON.stringify({
            source, category, status, dateFrom, dateTo, company, isRemote,
            search, location, type, id, region, sourceType, regionType, isTrusted, isNew,
            industry, isFeatured, isApproved, isAdmin
          }))

          items = []
          total = 0
          totalPages = 0
          aggregations = {}
          provider = 'neon-error'
        }
      } else {
        items = []
        total = 0
        totalPages = 0
        aggregations = {}
        provider = 'neon-not-configured'
      }


      // Member-only fields masking logic (isMember calculated above)

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
      // P0 Debug: Disable Cache temporarily
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      // res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
      return res.status(200).json({
        jobs: items,
        total,
        page: pageNum,
        pageSize,
        totalPages,
        aggregations
      })
    }

    if (req.method === 'POST') {
      const { action } = req.query

      // Handle translation action
      if (action === 'translate') {
        if (!NEON_CONFIGURED) return res.status(503).json({ error: 'Database not configured' })
        
        let { jobIds } = req.body
        if (!jobIds) return res.status(400).json({ error: 'jobIds is required' })
        if (!Array.isArray(jobIds)) jobIds = [jobIds]
        
        try {
            // 1. Fetch jobs
            const query = `SELECT * FROM ${JOBS_TABLE} WHERE job_id = ANY($1)`
            const result = await neonHelper.query(query, [jobIds])
            let jobs = (result || []).map(mapRowToJob)
            
            if (jobs.length === 0) return res.status(404).json({ error: 'No jobs found' })
            
            // 2. Translate
            if (translateJobs) {
                // Enable AI translation for this manual request
                if (configureTranslation) {
                    configureTranslation({ aiEnabled: true })
                }
                console.log(`[processed-jobs] Translating ${jobs.length} jobs (Force mode: true)...`)
                // Force translation even if already translated (user request)
                // Passing force=true to translateJobs
                jobs = await translateJobs(jobs, true)
                
                // 3. Save back (skip date filter to ensure we can translate old jobs)
                await writeJobsToNeon(jobs, 'upsert', true) // true = skipFilter
                
                return res.status(200).json({ success: true, count: jobs.length })
            } else {
                return res.status(500).json({ error: 'Translation service not available' })
            }
        } catch (e) {
            console.error('[processed-jobs] Translation error:', e)
            return res.status(500).json({ error: e.message })
        }
      }

      // Handle reprocess action (Refresh Processed Data)
      if (action === 'reprocess') {
        if (!NEON_CONFIGURED) return res.status(503).json({ error: 'Database not configured' })

        try {
          // Fetch jobs strategy:
          // 1. Recent 500 jobs (Ensure responsiveness for new data)
          // 2. Oldest 1500 "Dirty" jobs (Ensure full library coverage and cleaning of old data)

          const [recentJobs, dirtyJobs] = await Promise.all([
            neonHelper.query(`SELECT * FROM ${JOBS_TABLE} WHERE status = 'active' ORDER BY created_at DESC LIMIT 500`),
            neonHelper.query(`
              SELECT * FROM ${JOBS_TABLE} 
              WHERE status = 'active' 
              AND (is_manually_edited IS NOT TRUE)
              AND (
                location IS NULL OR location = 'Remote' OR location = 'Unspecified' 
                OR salary IS NULL OR salary = 'null' 
                OR category = '其他' 
                OR source_type IS NULL
              )
              ORDER BY updated_at ASC 
              LIMIT 1500
            `)
          ])

          // Merge and Dedupe
          const allJobsMap = new Map()
          if (recentJobs) recentJobs.forEach(j => allJobsMap.set(j.job_id, j))
          if (dirtyJobs) dirtyJobs.forEach(j => allJobsMap.set(j.job_id, j))
          const allJobs = Array.from(allJobsMap.values())

          // Filter candidates that need processing
          // Priority: Bad Location OR No Salary OR Category is '其他' OR Missing SourceType
          const candidates = allJobs.filter(j => {
            if (j.is_manually_edited) return false

            const badLocation = !j.location || j.location === 'Unspecified' || j.location.length < 2 || !isValidLocation(j.location)
            const noSalary = !j.salary || j.salary === 'null' || j.salary === 'Open' || j.salary === 'Competitive' || j.salary === '面议'
            const badCategory = !j.category || j.category === '其他' || j.category === 'Other'
            const noSourceType = !j.source_type

            // Must have description
            return (badLocation || noSalary || badCategory || noSourceType) && j.description && j.description.length > 50
          })

          // Sort by priority (Missing Salary & Location > Missing Salary > Missing Location)
          candidates.sort((a, b) => {
            const getScore = (job) => {
              let score = 0;
              if (!job.location || job.location === 'Unspecified') score += 2;
              if (!job.salary || job.salary === 'null' || job.salary === 'Open') score += 2;
              if (!job.category || job.category === '其他') score += 1;
              return score;
            }
            return getScore(b) - getScore(a);
          })

          // Process top 20 candidates (API Timeout limit)
          const batchSize = 20
          const targetJobs = candidates.slice(0, batchSize)

          console.log(`[processed-jobs] Reprocessing ${targetJobs.length} jobs (AI First Priority)...`)

          let updatedCount = 0
          let aiSuccessCount = 0
          let aiFailCount = 0
          const updates = []
          const failedJobs = []

          // Regex Fallback Logic
          const applyRegexFallback = (job) => {
            let changed = false

            // 1. Location
            if (!job.location || job.location === 'Remote' || job.location === 'Unspecified' || !isValidLocation(job.location)) {
              const extractedLoc = extractLocationFromText(job.title) || extractLocationFromText(job.description)
              if (extractedLoc && extractedLoc !== job.location) {
                job.location = extractedLoc
                changed = true
              }
            }

            // 2. Salary
            const extractedSalary = extractSalary(job.salary, job.title, job.description)
            if (extractedSalary && extractedSalary !== job.salary) {
              job.salary = extractedSalary
              changed = true
            }

            // 3. Region
            const newRegion = classifyRegion(job.location)
            if (newRegion !== job.region) {
              job.region = newRegion
              changed = true
            }

            // 4. Source Type
            if (!job.source_type) {
              if (job.can_refer) job.source_type = 'club-referral'
              else if (job.is_trusted) job.source_type = 'official'
              else job.source_type = 'rss'
              changed = true
            }

            return changed
          }

          // Process Batch
          const chunkSize = 5
          for (let i = 0; i < targetJobs.length; i += chunkSize) {
            const chunk = targetJobs.slice(i, i + chunkSize)
            await Promise.all(chunk.map(async (job) => {
              let changed = false
              let aiFailed = false

              try {
                // 1. AI First Strategy
                // Prepare clean description
                const cleanDesc = (job.description || '').replace(/<[^>]*>?/gm, '\n').replace(/\s+/g, ' ').trim()
                const jobForAI = { ...job, description: cleanDesc }

                const aiResult = await analyzeJobContent(jobForAI)

                if (aiResult) {
                  // Track Usage
                  if (aiResult.usage) {
                    await systemSettingsService.incrementTokenUsage(aiResult.usage, 'job_processing')
                  }

                  // Update Fields
                  if (aiResult.location && aiResult.location !== 'Unspecified') {
                    job.location = truncateString(aiResult.location, FIELD_LIMITS.location)
                    job.region = classifyRegion(job.location)
                    changed = true
                  }

                  if (aiResult.salary) {
                    job.salary = truncateString(aiResult.salary, FIELD_LIMITS.salary)
                    changed = true
                  }

                  if (aiResult.category && aiResult.category !== '其他') {
                    job.category = truncateString(aiResult.category, FIELD_LIMITS.category)
                    changed = true
                  }

                  if (aiResult.tags && Array.isArray(aiResult.tags) && aiResult.tags.length > 0) {
                    const newTags = aiResult.tags.map(t => truncateString(t, 50))
                    // Merge tags
                    const existingTags = Array.isArray(job.tags) ? job.tags : []
                    // Use Set to unique, prioritizing new AI tags
                    job.tags = [...new Set([...existingTags, ...newTags])].slice(0, 20)
                    changed = true
                  }

                  aiSuccessCount++
                } else {
                  aiFailed = true
                }
              } catch (e) {
                console.error(`[processed-jobs] AI failed for job ${job.job_id}:`, e.message)
                aiFailed = true
                failedJobs.push({ id: job.job_id, title: job.title, error: e.message })
              }

              // 2. Fallback Strategy (If AI failed or didn't run)
              if (aiFailed) {
                aiFailCount++
                const regexChanged = applyRegexFallback(job)
                if (regexChanged) changed = true
              }

              // Always check basic fields that might need default values even if AI succeeded
              if (!job.source_type) {
                if (job.can_refer) job.source_type = 'club-referral'
                else if (job.is_trusted) job.source_type = 'official'
                else job.source_type = 'rss'
                changed = true
              }
              // Recalculate region if location changed
              const finalRegion = classifyRegion(job.location)
              if (finalRegion !== job.region) {
                job.region = finalRegion
                changed = true
              }

              if (changed) {
                updates.push(job)
              }
            }))
          }

          if (updates.length > 0) {
            const mappedUpdates = updates.map(mapRowToJob)
            await writeJobsToNeon(mappedUpdates, 'upsert')
            updatedCount = updates.length
          }

          // Notification Logic
          if (failedJobs.length > 0) {
            const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'caitlinyct@gmail.com'
            const subject = `[Alert] AI Job Processing Failed for ${failedJobs.length} jobs`
            const content = `
                <h3>AI Processing Failed</h3>
                <p>Total Attempted: ${targetJobs.length}</p>
                <p>AI Success: ${aiSuccessCount}</p>
                <p>AI Failed (Fallback used): ${aiFailCount}</p>
                <h4>Failed Jobs Sample:</h4>
                <ul>
                    ${failedJobs.slice(0, 10).map(j => `<li>ID: ${j.id} - ${j.title} (${j.error})</li>`).join('')}
                </ul>
                <p>Please check Bailian API keys and quota.</p>
              `
            // Send asynchronously
            sendEmail(adminEmail, subject, content).catch(console.error)
          }

          console.log(`[processed-jobs] Reprocessed. Updates: ${updatedCount}, AI Success: ${aiSuccessCount}, AI Fail: ${aiFailCount}`)
          return res.status(200).json({ success: true, processed: targetJobs.length, updated: updatedCount, ai_success: aiSuccessCount, ai_fail: aiFailCount })
        } catch (e) {
          console.error('[processed-jobs] Reprocess failed:', e)
          return res.status(500).json({ error: 'Reprocess failed', details: e.message })
        }
      }

      // Handle cleanup action
      if (action === 'cleanup') {
        if (!NEON_CONFIGURED) return res.status(503).json({ error: 'Database not configured' })

        try {
          const days = Number(req.query.days) || RETAIN_DAYS
          const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

          // Get sources filter from body (if provided)
          // Use a raw body parser fallback if req.body is not parsed (Next.js API routes usually parse JSON if Content-Type is set)
          let body = req.body
          if (!body || typeof body !== 'object') {
            body = await new Promise((resolve) => {
              let data = ''
              req.on('data', chunk => data += chunk)
              req.on('end', () => {
                try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
              })
            })
          }
          const { sources } = body || {}

          // Delete jobs older than cutoff
          // Protection 1: Always protect manually edited jobs
          // Protection 2: If sources provided, ONLY delete jobs from those sources (e.g. RSS sync only cleans RSS jobs)

          let query = `DELETE FROM ${JOBS_TABLE} WHERE published_at IS NOT NULL AND published_at < $1`
          const params = [cutoffDate]

          // 1. Protect Manually Edited
          query += ` AND (is_manually_edited IS NOT TRUE)`

          // 2. Filter by Sources (if provided)
          // Note: If sources is an empty array, this will result in source = ANY('{}') which matches nothing.
          // This is desired: if no RSS sources are defined, we shouldn't be cleaning up random data.
          if (sources && Array.isArray(sources)) {
            query += ` AND source = ANY($${params.length + 1})`
            params.push(sources)
          }

          const result = await neonHelper.query(
            `${query} RETURNING job_id`,
            params
          )

          const deletedCount = result ? result.length : 0
          console.log(`[processed-jobs] Cleanup: Deleted ${deletedCount} jobs older than ${days} days (${cutoffDate})`)
          if (sources && sources.length > 0) {
            console.log(`[processed-jobs] Cleanup restricted to sources: ${sources.slice(0, 3).join(', ')}...`)
          }

          return res.status(200).json({ success: true, deleted: deletedCount, cutoff: cutoffDate })
        } catch (e) {
          console.error('[processed-jobs] Cleanup failed:', e)
          return res.status(500).json({ error: 'Cleanup failed', details: e.message })
        }
      }

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
      console.log(`[Backend] Received ${jobs.length} jobs for POST. Sample job[0].isApproved:`, jobs[0]?.isApproved); // Debug Log
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
        const timezone = truncateString(String(j.timezone || ''), 50)

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
          timezone,
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
          isApproved: !!j.isApproved,
          isManuallyEdited: !!j.isManuallyEdited,
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
      // Legacy 'append' logic removed for safety. 'append' now behaves like 'upsert' for the input batch only.
      if (mode === 'append') {
        toWrite = normalized
        provider = NEON_CONFIGURED ? 'neon' : 'neon-not-configured'
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
          console.log(`[Backend] About to write ${toWrite.length} jobs. Sample toWrite[0].isApproved:`, toWrite[0]?.isApproved); // Debug Log
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
