import neonHelper from '../../server-utils/dal/neon-helper.js'
import { sendDailyDigestEmail, isEmailServiceConfigured } from '../../server-utils/email-service.js'
import { isMembershipActive } from '../shared/membership.js'
import { JOB_CATEGORY_OPTIONS } from '../shared/job-categories.js'
import { CATEGORY_REVERSE_MAP } from '../services/classification-service.js'

const RUNS_TABLE = 'subscription_digest_runs'
const ITEMS_TABLE = 'subscription_digest_items'
const TIME_ZONE = 'Asia/Shanghai'
const MAX_JOBS_PER_EMAIL = 5
const WEEKLY_EMAIL_CAP = 3
const MIN_SEND_INTERVAL_HOURS = 24
const RELATED_FALLBACK_AFTER_DAYS = 3
const PRIMARY_WINDOW_DAYS = 7
const EXTENDED_WINDOW_DAYS = 14
const MAX_JOBS_PER_COMPANY = 2
const DIGEST_SCHEMA_ERROR_CODE = 'SUBSCRIPTION_DIGEST_SCHEMA_MISSING'

const EXTRA_TOPIC_ALIASES = {
  'ai产品经理': '产品经理',
  'ai 产品经理': '产品经理',
  '产品管理': '产品经理',
  pm: '产品经理',
  'product manager': '产品经理',
  'product owner': '产品经理',
  frontend: '前端开发',
  'front-end': '前端开发',
  backend: '后端开发',
  'back-end': '后端开发',
  fullstack: '全栈开发',
  'full-stack': '全栈开发',
  'full stack': '全栈开发',
  mobile: '移动开发',
  devops: '运维/SRE',
  sre: '运维/SRE',
  qa: '测试/QA',
  security: '网络安全',
  data: '数据分析',
  analytics: '数据分析',
  'data analyst': '数据分析',
  'business analyst': '商业分析',
  'data scientist': '数据科学',
  'ai engineer': '算法工程师',
  'machine learning': '算法工程师',
  'platform engineer': '平台工程师',
  'platform engineering': '平台工程师',
  marketing: '市场营销',
  sales: '销售',
  'customer success': '客户经理',
  'customer support': '客户服务',
  hr: '人力资源',
  recruiter: '招聘',
  finance: '财务',
  legal: '法务',
  operation: '运营',
  operations: '运营'
}

const TOPIC_RESOLUTION_ALIASES = {
  ...EXTRA_TOPIC_ALIASES,
  product: '产品经理',
  'product-management': '产品经理',
  data: '数据分析',
  ai: '算法工程师',
  ml: '算法工程师',
  'ai-ml': '算法工程师',
  frontend: '前端开发',
  backend: '后端开发',
  devops: '运维/SRE',
  qa: '测试/QA',
  security: '网络安全',
  marketing: '市场营销',
  sales: '销售',
  hr: '人力资源',
  finance: '财务',
  legal: '法务'
}

const RELATED_TOPIC_MAP = {
  后端开发: ['全栈开发', '服务器开发', '数据开发', '运维/SRE', '架构师', '软件开发', '平台工程师'],
  前端开发: ['全栈开发', 'UI/UX设计', '产品设计', '软件开发'],
  全栈开发: ['前端开发', '后端开发', '软件开发', '架构师'],
  移动开发: ['前端开发', '全栈开发', '软件开发'],
  数据开发: ['后端开发', '数据分析', '数据科学', '算法工程师'],
  服务器开发: ['后端开发', '运维/SRE', '架构师'],
  算法工程师: ['数据科学', '数据开发', '后端开发'],
  测试_QA: ['运维/SRE', '技术支持', '软件开发'],
  运维_SRE: ['后端开发', '服务器开发', '网络安全', '架构师'],
  网络安全: ['运维/SRE', '后端开发', '技术支持'],
  操作系统_内核: ['服务器开发', '后端开发', '硬件开发'],
  技术支持: ['客户服务', '运维/SRE', '测试/QA'],
  硬件开发: ['操作系统/内核', '服务器开发'],
  架构师: ['后端开发', '全栈开发', '服务器开发', 'CTO/技术管理'],
  CTO_技术管理: ['架构师', '管理', '后端开发'],
  软件开发: ['后端开发', '前端开发', '全栈开发'],
  平台工程师: ['后端开发', '运维/SRE', '服务器开发', '架构师'],
  产品经理: ['项目管理', '产品设计', '商业分析', '运营'],
  产品设计: ['产品经理', 'UI/UX设计', '用户研究'],
  项目管理: ['产品经理', '运营', '管理'],
  UI_UX设计: ['产品设计', '视觉设计', '用户研究', '前端开发'],
  视觉设计: ['UI/UX设计', '平面设计', '内容创作'],
  平面设计: ['视觉设计', '市场营销', '内容创作'],
  用户研究: ['产品设计', '产品经理', '数据分析'],
  市场营销: ['增长黑客', '内容创作', '商务拓展', '运营', '销售'],
  销售: ['客户经理', '商务拓展', '市场营销'],
  客户经理: ['销售', '客户服务', '商务拓展'],
  客户服务: ['客户经理', '技术支持', '运营'],
  运营: ['增长黑客', '市场营销', '产品经理', '内容创作'],
  增长黑客: ['市场营销', '运营', '数据分析'],
  内容创作: ['市场营销', '运营', '视觉设计'],
  商务拓展: ['销售', '市场营销', '客户经理'],
  人力资源: ['招聘', '行政', '管理'],
  招聘: ['人力资源', '销售', '客户经理'],
  财务: ['商业分析', '管理', '行政'],
  法务: ['行政', '管理'],
  行政: ['人力资源', '财务', '法务'],
  管理: ['CTO/技术管理', '项目管理', '人力资源'],
  数据分析: ['商业分析', '数据科学', '数据开发', '增长黑客'],
  商业分析: ['数据分析', '产品经理', '财务'],
  数据科学: ['算法工程师', '数据分析', '数据开发'],
  教育培训: ['内容创作', '客户服务', '咨询'],
  咨询: ['商业分析', '产品经理', '管理'],
  投资: ['财务', '商业分析', '咨询'],
  游戏: ['产品经理', '运营', '软件开发']
}

function createDigestSchemaError(message = 'Subscription digest tables are missing') {
  const error = new Error(message)
  error.code = DIGEST_SCHEMA_ERROR_CODE
  return error
}

function isDigestSchemaError(error) {
  return error?.code === DIGEST_SCHEMA_ERROR_CODE
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[/\s_-]+/g, '')
}

function normalizeTopicKey(topic) {
  return String(topic || '').replace(/\//g, '_')
}

function safeParseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function uniqueStrings(values = []) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const text = String(value || '').trim().replace(/\s+/g, ' ')
    if (!text) continue
    const key = normalizeKey(text)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(text)
  }
  return output
}

function getDateParts(date = new Date(), timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day
  }
}

function getBatchDate(date = new Date(), timeZone = TIME_ZONE) {
  const parts = getDateParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function parseBatchDate(batchDate) {
  const [year, month, day] = String(batchDate || '').split('-').map((value) => Number.parseInt(value, 10))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function getWeekStart(batchDate) {
  const date = parseBatchDate(batchDate)
  if (!date) return batchDate
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function getDayOfWeek(batchDate) {
  const date = parseBatchDate(batchDate)
  if (!date) return 1
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

function hoursSince(value, now = new Date()) {
  if (!value) return Number.POSITIVE_INFINITY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  return (now.getTime() - date.getTime()) / (60 * 60 * 1000)
}

function daysSince(value, now = new Date()) {
  return hoursSince(value, now) / 24
}

function getJobFreshAt(job = {}) {
  return job.publishedAt || job.createdAt || job.updatedAt || null
}

function getJobAgeDays(job, now = new Date()) {
  const freshAt = getJobFreshAt(job)
  if (!freshAt) return Number.POSITIVE_INFINITY
  const date = new Date(freshAt)
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  return Math.max(0, (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
}

function getTopicKeywords(topic) {
  return uniqueStrings([
    topic,
    ...String(topic || '').split(/[/\\]/),
    ...(CATEGORY_REVERSE_MAP[topic] || []),
    ...Object.entries(EXTRA_TOPIC_ALIASES)
      .filter(([, category]) => category === topic)
      .map(([alias]) => alias)
  ])
}

function resolveStandardTopic(value) {
  const normalized = normalizeKey(value)
  if (!normalized) return ''

  for (const category of JOB_CATEGORY_OPTIONS) {
    const categoryKey = normalizeKey(category)
    if (normalized === categoryKey || normalized.includes(categoryKey)) return category
  }

  for (const category of uniqueStrings(Object.values(TOPIC_RESOLUTION_ALIASES))) {
    const categoryKey = normalizeKey(category)
    if (normalized === categoryKey || normalized.includes(categoryKey)) return category
  }

  for (const [alias, category] of Object.entries(TOPIC_RESOLUTION_ALIASES)) {
    const aliasKey = normalizeKey(alias)
    if (normalized === aliasKey || normalized.includes(aliasKey)) return category
  }

  for (const [category, keywords] of Object.entries(CATEGORY_REVERSE_MAP)) {
    for (const keyword of keywords || []) {
      const keywordKey = normalizeKey(keyword)
      if (keywordKey && (normalized === keywordKey || normalized.includes(keywordKey))) return category
    }
  }

  return ''
}

function parseSubscriptionTopics(subscription = {}) {
  const preferences = safeParseJson(subscription.preferences, {}) || {}
  const rawTopics = Array.isArray(preferences.topics)
    ? preferences.topics
    : String(subscription.topic || '').split(',')
  const rawCustomTopics = uniqueStrings([
    ...(Array.isArray(preferences.customTopics) ? preferences.customTopics : []),
    preferences.customTopic
  ])

  const standardTopics = []
  const customTopics = []

  for (const topic of uniqueStrings([...rawTopics, ...rawCustomTopics])) {
    if (normalizeKey(topic) === normalizeKey('other')) continue
    const standardTopic = resolveStandardTopic(topic)
    if (standardTopic && standardTopic !== '其他') {
      standardTopics.push(standardTopic)
    } else {
      customTopics.push(topic)
    }
  }

  return {
    standardTopics: uniqueStrings(standardTopics),
    customTopics: uniqueStrings(customTopics),
    displayTopics: uniqueStrings([...standardTopics, ...customTopics])
  }
}

function getRelatedTopics(standardTopics = []) {
  const related = []
  const standardSet = new Set(standardTopics)
  for (const topic of standardTopics) {
    const relatedKey = normalizeTopicKey(topic)
    for (const item of RELATED_TOPIC_MAP[relatedKey] || RELATED_TOPIC_MAP[topic] || []) {
      if (!standardSet.has(item)) related.push(item)
    }
  }
  return uniqueStrings(related)
}

function includesText(value, keyword) {
  const haystack = String(value || '').toLowerCase()
  const needle = String(keyword || '').toLowerCase()
  if (!needle) return false
  if (/^[a-z0-9+#.]{1,3}$/i.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(haystack)
  }
  return haystack.includes(needle)
}

function getTags(job = {}) {
  if (Array.isArray(job.tags)) return job.tags
  return safeParseJson(job.tags, []) || []
}

function scoreAgainstTopic(job, topic, tier = 'primary') {
  const category = String(job.category || '')
  const title = String(job.title || '')
  const description = String(job.description || '')
  const tags = getTags(job).map((tag) => String(tag || ''))
  const keywords = getTopicKeywords(topic)
  const categoryStandard = resolveStandardTopic(category)
  const hasDifferentKnownCategory = tier === 'primary'
    && categoryStandard
    && categoryStandard !== topic
  let score = 0

  if (normalizeKey(category) === normalizeKey(topic)) score = Math.max(score, tier === 'primary' ? 100 : 74)
  if (normalizeKey(category).includes(normalizeKey(topic))) score = Math.max(score, tier === 'primary' ? 90 : 68)

  for (const keyword of keywords) {
    if (includesText(category, keyword)) score = Math.max(score, tier === 'primary' ? 88 : 66)
    if (includesText(title, keyword)) score = Math.max(score, hasDifferentKnownCategory ? 52 : (tier === 'primary' ? 86 : 64))
    if (tags.some((tag) => includesText(tag, keyword))) score = Math.max(score, hasDifferentKnownCategory ? 45 : (tier === 'primary' ? 78 : 60))
    if (includesText(description, keyword)) score = Math.max(score, hasDifferentKnownCategory ? 20 : (tier === 'primary' ? 45 : 28))
  }

  return score
}

function scoreAgainstCustomTopic(job, topic) {
  const tags = getTags(job).map((tag) => String(tag || ''))
  let score = 0

  if (includesText(job.category, topic)) score = Math.max(score, 78)
  if (includesText(job.title, topic)) score = Math.max(score, 82)
  if (tags.some((tag) => includesText(tag, topic))) score = Math.max(score, 70)
  if (includesText(job.description, topic)) score = Math.max(score, 45)

  return score
}

function findBestMatch(job, topics, tier) {
  let best = null
  for (const topic of topics) {
    const score = scoreAgainstTopic(job, topic, tier)
    if (!best || score > best.score) {
      best = { score, matchedTopic: topic, matchTier: tier }
    }
  }
  return best || { score: 0, matchedTopic: '', matchTier: tier }
}

function findBestCustomMatch(job, topics) {
  let best = null
  for (const topic of topics) {
    const score = scoreAgainstCustomTopic(job, topic)
    if (!best || score > best.score) {
      best = { score, matchedTopic: topic, matchTier: 'primary' }
    }
  }
  return best || { score: 0, matchedTopic: '', matchTier: 'primary' }
}

function getFreshnessBoost(job) {
  const age = getJobAgeDays(job)
  if (age <= 1) return 12
  if (age <= 3) return 9
  if (age <= PRIMARY_WINDOW_DAYS) return 5
  return -8
}

function getQualityBoost(job) {
  return [
    job.canRefer ? 8 : 0,
    job.isFeatured ? 6 : 0,
    job.memberOnly ? 4 : 0,
    job.isTrusted ? 3 : 0
  ].reduce((sum, value) => sum + value, 0)
}

function buildScoredMatches(jobs, subscriptionTopics, options = {}) {
  const {
    allowExtendedWindow = false,
    sentJobIds = new Set()
  } = options
  const relatedTopics = getRelatedTopics(subscriptionTopics.standardTopics)
  const primaryMatches = []
  const relatedMatches = []
  const maxAge = allowExtendedWindow ? EXTENDED_WINDOW_DAYS : PRIMARY_WINDOW_DAYS

  for (const job of jobs) {
    if (!job.id || sentJobIds.has(String(job.id))) continue
    const ageDays = getJobAgeDays(job)
    if (ageDays > maxAge) continue

    const bestStandard = findBestMatch(job, subscriptionTopics.standardTopics, 'primary')
    const bestCustom = findBestCustomMatch(job, subscriptionTopics.customTopics)
    const primary = bestCustom.score > bestStandard.score ? bestCustom : bestStandard

    if (primary.score >= 60) {
      const recencyPenalty = ageDays > PRIMARY_WINDOW_DAYS ? -12 : 0
      primaryMatches.push({
        ...job,
        matchTier: 'primary',
        matchedTopic: primary.matchedTopic,
        matchScore: primary.score,
        sortScore: primary.score + getFreshnessBoost(job) + getQualityBoost(job) + recencyPenalty
      })
      continue
    }

    const related = findBestMatch(job, relatedTopics, 'related')
    if (related.score >= 55) {
      const recencyPenalty = ageDays > PRIMARY_WINDOW_DAYS ? -16 : 0
      relatedMatches.push({
        ...job,
        matchTier: 'related',
        matchedTopic: related.matchedTopic,
        matchScore: related.score,
        sortScore: related.score + getFreshnessBoost(job) + getQualityBoost(job) + recencyPenalty
      })
    }
  }

  const sortMatches = (items) => items.sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore
    return new Date(getJobFreshAt(b) || 0).getTime() - new Date(getJobFreshAt(a) || 0).getTime()
  })

  return {
    primaryMatches: sortMatches(primaryMatches),
    relatedMatches: sortMatches(relatedMatches)
  }
}

function selectWithCompanyLimit(candidates, limit = MAX_JOBS_PER_EMAIL) {
  const selected = []
  const companyCounts = new Map()
  const seenIds = new Set()

  for (const job of candidates) {
    if (selected.length >= limit) break
    const jobId = String(job.id || '')
    if (!jobId || seenIds.has(jobId)) continue

    const companyKey = String(job.company || 'unknown').trim().toLowerCase() || 'unknown'
    const count = companyCounts.get(companyKey) || 0
    if (count >= MAX_JOBS_PER_COMPANY) continue

    selected.push(job)
    seenIds.add(jobId)
    companyCounts.set(companyKey, count + 1)
  }

  return selected
}

function buildSelection(jobs, subscriptionTopics, history, now = new Date()) {
  const allowExtendedWindow = Number(history.weekSentCount || 0) === 0
  const allowRelated = Number(history.noPrimarySkipCount || 0) >= RELATED_FALLBACK_AFTER_DAYS - 1
    || (Number(history.weekSentCount || 0) > 0 && daysSince(history.lastSentAt, now) >= RELATED_FALLBACK_AFTER_DAYS)
    || (Number(history.weekSentCount || 0) === 0 && getDayOfWeek(history.batchDate) >= 5)

  const { primaryMatches, relatedMatches } = buildScoredMatches(jobs, subscriptionTopics, {
    allowExtendedWindow,
    sentJobIds: history.sentJobIds
  })

  if (primaryMatches.length > 0) {
    const primarySelection = selectWithCompanyLimit(primaryMatches, MAX_JOBS_PER_EMAIL)
    const remaining = MAX_JOBS_PER_EMAIL - primarySelection.length
    if (remaining <= 0 || primarySelection.length >= 3) {
      return {
        selectedJobs: primarySelection,
        primaryCandidateCount: primaryMatches.length,
        relatedCandidateCount: relatedMatches.length,
        reason: 'primary_match'
      }
    }

    const selectedIds = new Set(primarySelection.map((job) => String(job.id)))
    const relatedFill = allowRelated
      ? selectWithCompanyLimit(relatedMatches.filter((job) => !selectedIds.has(String(job.id))), remaining)
      : []

    return {
      selectedJobs: [...primarySelection, ...relatedFill],
      primaryCandidateCount: primaryMatches.length,
      relatedCandidateCount: relatedMatches.length,
      reason: relatedFill.length ? 'primary_with_related_fill' : 'primary_match'
    }
  }

  if (!allowRelated) {
    return {
      selectedJobs: [],
      primaryCandidateCount: 0,
      relatedCandidateCount: relatedMatches.length,
      reason: 'waiting_for_primary_or_related_cooldown'
    }
  }

  return {
    selectedJobs: selectWithCompanyLimit(relatedMatches, MAX_JOBS_PER_EMAIL),
    primaryCandidateCount: 0,
    relatedCandidateCount: relatedMatches.length,
    reason: relatedMatches.length ? 'related_fallback' : 'no_relevant_jobs'
  }
}

function normalizeJobRow(row = {}) {
  return {
    id: row.job_id,
    title: row.title,
    company: row.trusted_company_name || row.company,
    location: row.location,
    salary: row.salary,
    description: row.description,
    url: row.url,
    category: row.category,
    jobType: row.job_type,
    experienceLevel: row.experience_level,
    tags: safeParseJson(row.tags, []),
    isTrusted: row.is_trusted === true,
    canRefer: row.can_refer === true,
    memberOnly: row.member_only === true,
    isFeatured: row.is_featured === true,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function ensureDigestTablesReady() {
  const rows = await neonHelper.query(
    `SELECT
       to_regclass('public.subscription_digest_runs') AS runs_table,
       to_regclass('public.subscription_digest_items') AS items_table`
  )
  const row = rows?.[0] || {}
  if (!row.runs_table || !row.items_table) {
    throw createDigestSchemaError(
      '会员订阅邮件推送依赖的数据表不存在，请先执行迁移 042_subscription_digest_history.sql'
    )
  }
}

async function fetchActiveSubscriptions() {
  return await neonHelper.query(
    `SELECT
       s.*,
       u.email AS user_email,
       u.username AS user_name,
       u.roles,
       u.member_status,
       u.member_type,
       u.membership_level,
       u.member_expire_at,
       u.membership_expire_at,
       u.member_cycle_start_at
     FROM subscriptions s
     LEFT JOIN users u
       ON u.user_id::text = s.user_id::text
       OR (s.user_id IS NULL AND LOWER(u.email) = LOWER(s.identifier))
     WHERE s.status = 'active'
       AND s.channel = 'email'
       AND COALESCE(NULLIF(BTRIM(s.identifier), ''), NULL) IS NOT NULL
     ORDER BY s.created_at ASC`
  )
}

async function fetchCandidateJobs() {
  const rows = await neonHelper.query(
    `SELECT
       j.job_id,
       j.title,
       j.company,
       j.location,
       j.salary,
       j.description,
       j.url,
       j.category,
       j.job_type,
       j.experience_level,
       j.tags,
       j.is_trusted,
       j.can_refer,
       j.member_only,
       j.is_featured,
       j.published_at,
       j.created_at,
       j.updated_at,
       tc.name AS trusted_company_name
     FROM jobs j
     LEFT JOIN trusted_companies tc
       ON j.company_id = tc.company_id
       OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name)))
     WHERE j.status = 'active'
       AND COALESCE(j.is_approved, false) = true
       AND COALESCE(NULLIF(BTRIM(j.title), ''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(BTRIM(j.company), ''), NULL) IS NOT NULL
       AND (
         COALESCE(j.published_at, j.created_at) >= NOW() - ($1::int * INTERVAL '1 day')
         OR (
           j.published_at IS NULL
           AND j.created_at IS NULL
           AND j.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
         )
       )
     ORDER BY COALESCE(j.published_at, j.created_at, j.updated_at) DESC NULLS LAST,
       j.updated_at DESC NULLS LAST,
       j.job_id DESC
     LIMIT 600`,
    [EXTENDED_WINDOW_DAYS]
  )

  return (rows || []).map(normalizeJobRow)
}

async function fetchSubscriptionHistory(subscriptionId, weekKey) {
  const [runRows, skippedRows, itemRows] = await Promise.all([
    neonHelper.query(
      `SELECT COUNT(*)::int AS week_sent_count, MAX(sent_at) AS last_sent_at
       FROM ${RUNS_TABLE}
       WHERE subscription_id = $1
         AND week_key = $2
         AND status = 'sent'`,
      [String(subscriptionId), weekKey]
    ),
    neonHelper.query(
      `SELECT COUNT(*)::int AS no_primary_skip_count
       FROM ${RUNS_TABLE}
       WHERE subscription_id = $1
         AND week_key = $2
         AND status = 'skipped'
         AND error IN ('waiting_for_primary_or_related_cooldown', 'no_relevant_jobs')`,
      [String(subscriptionId), weekKey]
    ),
    neonHelper.query(
      `SELECT job_id
       FROM ${ITEMS_TABLE}
       WHERE subscription_id = $1
         AND week_key = $2`,
      [String(subscriptionId), weekKey]
    )
  ])

  return {
    weekSentCount: Number(runRows?.[0]?.week_sent_count || 0),
    lastSentAt: runRows?.[0]?.last_sent_at || null,
    noPrimarySkipCount: Number(skippedRows?.[0]?.no_primary_skip_count || 0),
    sentJobIds: new Set((itemRows || []).map((row) => String(row.job_id)).filter(Boolean))
  }
}

async function claimRun({ subscription, batchDate, weekKey }) {
  const rows = await neonHelper.query(
    `INSERT INTO ${RUNS_TABLE} (
       subscription_id,
       user_id,
       identifier,
       batch_date,
       week_key,
       timezone,
       status,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'processing', NOW(), NOW())
     ON CONFLICT (batch_date, subscription_id) DO NOTHING
     RETURNING *`,
    [
      String(subscription.subscription_id),
      subscription.user_id ? String(subscription.user_id) : null,
      String(subscription.identifier || '').toLowerCase(),
      batchDate,
      weekKey,
      TIME_ZONE
    ]
  )

  if (rows?.[0]) return { acquired: true, run: rows[0] }

  const existing = await neonHelper.query(
    `SELECT *
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1
       AND subscription_id = $2
     LIMIT 1`,
    [batchDate, String(subscription.subscription_id)]
  )

  return { acquired: false, run: existing?.[0] || null }
}

async function markRunSkipped(runId, reason, payload = {}) {
  if (!runId) return
  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'skipped',
         payload = $2::jsonb,
         error = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [runId, JSON.stringify(payload), reason]
  )
}

async function markRunFailed(runId, error, payload = {}) {
  if (!runId) return
  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'failed',
         payload = $2::jsonb,
         error = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [runId, JSON.stringify(payload), String(error?.message || error || 'Unknown error').slice(0, 2000)]
  )
}

async function markRunSent(runId, { selectedJobs, subject, payload }) {
  const primaryCount = selectedJobs.filter((job) => job.matchTier === 'primary').length
  const relatedCount = selectedJobs.filter((job) => job.matchTier === 'related').length

  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'sent',
         job_count = $2,
         primary_count = $3,
         related_count = $4,
         subject = $5,
         payload = $6::jsonb,
         error = NULL,
         sent_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [
      runId,
      selectedJobs.length,
      primaryCount,
      relatedCount,
      subject,
      JSON.stringify(payload || {})
    ]
  )
}

async function recordDigestItems({ runId, subscription, batchDate, weekKey, selectedJobs }) {
  for (const job of selectedJobs) {
    await neonHelper.query(
      `INSERT INTO ${ITEMS_TABLE} (
         run_id,
         subscription_id,
         user_id,
         identifier,
         batch_date,
         week_key,
         job_id,
         match_tier,
         match_score,
         matched_topic,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (subscription_id, job_id, week_key) DO NOTHING`,
      [
        runId,
        String(subscription.subscription_id),
        subscription.user_id ? String(subscription.user_id) : null,
        String(subscription.identifier || '').toLowerCase(),
        batchDate,
        weekKey,
        String(job.id),
        job.matchTier,
        Number(job.matchScore || 0),
        job.matchedTopic || null
      ]
    )
  }
}

function buildUserFromSubscription(subscription = {}) {
  return {
    user_id: subscription.user_id,
    email: subscription.user_email || subscription.identifier,
    username: subscription.user_name,
    roles: safeParseJson(subscription.roles, subscription.roles || {}),
    member_status: subscription.member_status,
    member_type: subscription.member_type,
    membership_level: subscription.membership_level,
    member_expire_at: subscription.member_expire_at || subscription.membership_expire_at,
    member_cycle_start_at: subscription.member_cycle_start_at
  }
}

function getTopicLabel(topics) {
  const label = uniqueStrings(topics.displayTopics).join('、')
  return label || '远程岗位'
}

function buildSubject(subscriptionTopics, selectedJobs) {
  const label = getTopicLabel(subscriptionTopics)
  const primaryCount = selectedJobs.filter((job) => job.matchTier === 'primary').length
  if (primaryCount > 0) {
    return `你订阅的「${label}」方向有新岗位`
  }
  return `你关注的「${label}」方向有相关岗位更新`
}

function buildPreviewJob(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    category: job.category,
    matchTier: job.matchTier,
    matchScore: job.matchScore,
    matchedTopic: job.matchedTopic,
    freshAt: getJobFreshAt(job)
  }
}

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function getRequestFlag(req, key) {
  const value = req?.query?.[key] ?? req?.body?.[key]
  return value === true || String(value || '').toLowerCase() === 'true' || String(value || '') === '1'
}

export async function sendDailyDigests(reqOrRes, maybeRes) {
  const req = maybeRes ? reqOrRes : null
  const res = maybeRes || reqOrRes
  const dryRun = getRequestFlag(req, 'dryRun')
  const now = new Date()
  const batchDate = getBatchDate(now, TIME_ZONE)
  const weekKey = getWeekStart(batchDate)

  if (!dryRun && !isEmailServiceConfigured()) {
    writeEvent(res, { type: 'error', message: 'Email service not configured. Use dryRun=1 for local preview.' })
    res.end()
    return
  }

  try {
    await ensureDigestTablesReady()

    const [subscriptions, jobs] = await Promise.all([
      fetchActiveSubscriptions(),
      fetchCandidateJobs()
    ])

    if (!subscriptions || subscriptions.length === 0) {
      writeEvent(res, { type: 'info', message: 'No active subscriptions found' })
      res.end()
      return
    }

    writeEvent(res, {
      type: 'start',
      dryRun,
      batchDate,
      weekKey,
      subscriptions: subscriptions.length,
      candidateJobs: jobs.length
    })

    let sentCount = 0
    let errorCount = 0
    let skippedCount = 0
    const previews = []

    for (const subscription of subscriptions) {
      const subscriptionId = String(subscription.subscription_id)
      const identifier = String(subscription.identifier || '').toLowerCase()
      let run = null

      try {
        const user = buildUserFromSubscription(subscription)
        const subscriptionTopics = parseSubscriptionTopics(subscription)

        if (!isMembershipActive(user)) {
          skippedCount++
          previews.push({ subscriptionId, identifier, skipped: true, reason: 'membership_inactive' })
          if (!dryRun) {
            const claim = await claimRun({ subscription, batchDate, weekKey })
            run = claim.run
            if (claim.acquired) await markRunSkipped(run?.id, 'membership_inactive', { identifier })
          }
          continue
        }

        if (subscriptionTopics.displayTopics.length === 0) {
          skippedCount++
          previews.push({ subscriptionId, identifier, skipped: true, reason: 'empty_topics' })
          if (!dryRun) {
            const claim = await claimRun({ subscription, batchDate, weekKey })
            run = claim.run
            if (claim.acquired) await markRunSkipped(run?.id, 'empty_topics', { identifier })
          }
          continue
        }

        if (!dryRun) {
          const claim = await claimRun({ subscription, batchDate, weekKey })
          run = claim.run
          if (!claim.acquired && run?.status === 'sent') {
            skippedCount++
            previews.push({ subscriptionId, identifier, skipped: true, reason: 'already_sent_today' })
            continue
          }
          if (!claim.acquired && run?.status === 'processing') {
            skippedCount++
            previews.push({ subscriptionId, identifier, skipped: true, reason: 'already_processing_today' })
            continue
          }
        }

        const history = {
          ...(await fetchSubscriptionHistory(subscriptionId, weekKey)),
          batchDate
        }

        if (history.weekSentCount >= WEEKLY_EMAIL_CAP) {
          skippedCount++
          previews.push({ subscriptionId, identifier, skipped: true, reason: 'weekly_cap_reached' })
          if (!dryRun) await markRunSkipped(run?.id, 'weekly_cap_reached', { weekSentCount: history.weekSentCount })
          continue
        }

        if (hoursSince(history.lastSentAt, now) < MIN_SEND_INTERVAL_HOURS) {
          skippedCount++
          previews.push({ subscriptionId, identifier, skipped: true, reason: 'send_interval_too_short' })
          if (!dryRun) await markRunSkipped(run?.id, 'send_interval_too_short', { lastSentAt: history.lastSentAt })
          continue
        }

        const selection = buildSelection(jobs, subscriptionTopics, history, now)

        if (selection.selectedJobs.length === 0) {
          skippedCount++
          previews.push({
            subscriptionId,
            identifier,
            skipped: true,
            reason: selection.reason,
            primaryCandidateCount: selection.primaryCandidateCount,
            relatedCandidateCount: selection.relatedCandidateCount,
            topics: subscriptionTopics.displayTopics
          })
          if (!dryRun) {
            await markRunSkipped(run?.id, selection.reason, {
              topics: subscriptionTopics.displayTopics,
              primaryCandidateCount: selection.primaryCandidateCount,
              relatedCandidateCount: selection.relatedCandidateCount
            })
          }
          continue
        }

        const subject = buildSubject(subscriptionTopics, selection.selectedJobs)
        const payload = {
          topics: subscriptionTopics.displayTopics,
          reason: selection.reason,
          jobs: selection.selectedJobs.map(buildPreviewJob),
          primaryCandidateCount: selection.primaryCandidateCount,
          relatedCandidateCount: selection.relatedCandidateCount
        }

        if (dryRun) {
          previews.push({
            subscriptionId,
            identifier,
            skipped: false,
            subject,
            topics: subscriptionTopics.displayTopics,
            reason: selection.reason,
            jobs: selection.selectedJobs.map(buildPreviewJob)
          })
          sentCount++
          continue
        }

        const success = await sendDailyDigestEmail(identifier, selection.selectedJobs, getTopicLabel(subscriptionTopics), {
          subject,
          topics: subscriptionTopics.displayTopics
        })

        if (!success) {
          errorCount++
          const currentFailCount = Number(subscription.fail_count || 0) + 1
          await markRunFailed(run?.id, 'email_send_failed', payload)
          if (currentFailCount >= 3) {
            await neonHelper.update(
              'subscriptions',
              {
                status: 'bounced',
                fail_count: currentFailCount,
                updated_at: now.toISOString()
              },
              { subscription_id: subscription.subscription_id }
            )
          } else {
            await neonHelper.update('subscriptions', { fail_count: currentFailCount }, { subscription_id: subscription.subscription_id })
          }
          previews.push({ subscriptionId, identifier, skipped: false, failed: true, reason: 'email_send_failed' })
          continue
        }

        await markRunSent(run?.id, { selectedJobs: selection.selectedJobs, subject, payload })
        await recordDigestItems({ runId: run?.id, subscription, batchDate, weekKey, selectedJobs: selection.selectedJobs })
        await neonHelper.update(
          'subscriptions',
          {
            last_sent_at: now.toISOString(),
            fail_count: 0,
            status: 'active',
            updated_at: now.toISOString()
          },
          { subscription_id: subscription.subscription_id }
        )

        sentCount++
        previews.push({
          subscriptionId,
          identifier,
          skipped: false,
          subject,
          topics: subscriptionTopics.displayTopics,
          reason: selection.reason,
          jobs: selection.selectedJobs.map(buildPreviewJob)
        })

        if ((sentCount + errorCount + skippedCount) % 10 === 0) {
          writeEvent(res, { type: 'progress', sent: sentCount, errors: errorCount, skipped: skippedCount })
        }
      } catch (error) {
        errorCount++
        console.error(`[DailyDigest] Error processing ${identifier}:`, error)
        if (!dryRun) await markRunFailed(run?.id, error)
        previews.push({ subscriptionId, identifier, failed: true, error: error.message })
      }
    }

    writeEvent(res, {
      type: 'complete',
      dryRun,
      batchDate,
      weekKey,
      stats: { sent: sentCount, errors: errorCount, skipped: skippedCount },
      previews: dryRun ? previews : previews.slice(0, 20),
      message: dryRun
        ? `Dry run selected ${sentCount} digests, ${skippedCount} skipped, ${errorCount} failed`
        : `Sent ${sentCount} digests, ${skippedCount} skipped, ${errorCount} failed`
    })
    res.end()
  } catch (error) {
    console.error('[DailyDigest] Critical error:', error)
    writeEvent(res, {
      type: 'error',
      message: error.message,
      code: error?.code || null,
      migrationRequired: isDigestSchemaError(error)
    })
    res.end()
  }
}
