import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

const DEFAULT_SITE_URL = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
const SUMMARY_MODEL = process.env.ALIBABA_BAILIAN_XHS_MODEL || process.env.ALIBABA_BAILIAN_SUMMARY_MODEL || process.env.ALIBABA_BAILIAN_MODEL || 'qwen-plus'
const SUMMARY_TEMPLATE_VERSION = 'xhs-v7'
const DRAFT_TEMPLATE_VERSION = 'xhs-v2'
const JOB_SUMMARY_MIN_LENGTH = 160
const JOB_SUMMARY_MAX_LENGTH = 360
const JOB_SUMMARY_HARD_LIMIT = 460
const COMPANY_SUMMARY_MIN_LENGTH = 60
const COMPANY_SUMMARY_MAX_LENGTH = 110
const EMAIL_TYPE_LABELS = {
  招聘专用邮箱: '招聘邮箱',
  通用支持邮箱: '通用邮箱',
  内部员工邮箱: '员工邮箱',
  企业领导邮箱: '高管邮箱',
  招聘邮箱: '招聘邮箱',
  通用邮箱: '通用邮箱',
  员工邮箱: '员工邮箱',
  高管邮箱: '高管邮箱',
  HR邮箱: 'HR邮箱'
}

if (!globalThis.__haigoo_xhs_summary_cache) {
  globalThis.__haigoo_xhs_summary_cache = new Map()
}
if (!globalThis.__haigoo_xhs_draft_table_ready) {
  globalThis.__haigoo_xhs_draft_table_ready = null
}

const SUMMARY_CACHE = globalThis.__haigoo_xhs_summary_cache
const XHS_DRAFT_TABLE_READY = '__haigoo_xhs_draft_table_ready'

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function safeParseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''))
}

function preferChinese(primary, fallback = '') {
  const normalizedPrimary = normalizeText(primary)
  if (normalizedPrimary && hasChinese(normalizedPrimary)) return normalizedPrimary
  return normalizedPrimary || normalizeText(fallback)
}

function normalizeEmailTypeLabel(value, fallback = '通用邮箱') {
  return EMAIL_TYPE_LABELS[String(value || '').trim()] || normalizeText(value, fallback)
}

function normalizeArrayInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeReferralContacts(raw, fallbackHiringEmail = '', fallbackEmailType = '') {
  let parsed = []

  if (Array.isArray(raw)) {
    parsed = raw
  } else if (typeof raw === 'string') {
    try {
      const next = JSON.parse(raw)
      parsed = Array.isArray(next) ? next : []
    } catch (_error) {
      parsed = []
    }
  } else if (raw && typeof raw === 'object') {
    parsed = [raw]
  }

  const normalized = parsed
    .map((item) => ({
      id: normalizeText(item?.id || item?.contactId),
      name: normalizeText(item?.name),
      title: normalizeText(item?.title || item?.position),
      hiringEmail: normalizeText(item?.hiringEmail || item?.email),
      emailType: normalizeEmailTypeLabel(item?.emailType || fallbackEmailType)
    }))
    .filter((item) => item.name || item.title || item.hiringEmail)

  if (normalized.length > 0) return normalized

  const fallbackEmail = normalizeText(fallbackHiringEmail)
  if (!fallbackEmail) return []

  return [{
    name: '',
    title: '',
    hiringEmail: fallbackEmail,
    emailType: normalizeEmailTypeLabel(fallbackEmailType)
  }]
}

function pickPrimaryReferralContact(contacts = []) {
  if (!Array.isArray(contacts) || contacts.length === 0) return null

  const scored = contacts
    .map((contact) => ({
      ...contact,
      score: (contact.hiringEmail ? 3 : 0) + (contact.name ? 2 : 0) + (contact.title ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)

  return scored[0] || null
}

function formatCompactField(parts = []) {
  return parts.map((part) => normalizeText(part, '待补充')).join('｜')
}

function formatReferralLine(contact = {}) {
  return `${normalizeText(contact?.name, '待补充')}｜${normalizeText(contact?.title, '待补充')}：${normalizeText(contact?.hiringEmail, '待补充')}`
}

function formatTypedReferralLine(contact = {}) {
  return `${normalizeEmailTypeLabel(contact?.emailType)}：${formatReferralLine(contact)}`
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSummarySentences(value = '') {
  return stripHtml(value)
    .split(/[\n\r]+|(?<=[。！？!?.；;])/)
    .map((item) => item.replace(/^[\s•·▪●\-–—\d.()]+/, '').trim())
    .filter(Boolean)
}

function dedupeSentences(sentences = []) {
  const deduped = []
  const seen = new Set()

  for (const sentence of sentences) {
    const key = String(sentence || '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(sentence)
  }

  return deduped
}

function clampSentence(sentence = '', maxLength = 42) {
  const clean = normalizeText(sentence).replace(/\s+/g, ' ')
  if (!clean) return ''
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, Math.max(0, maxLength - 1)).replace(/[，,；;、:：\s]+$/u, '')}…`
}

function sentenceMatches(sentence = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(sentence))
}

function buildSectionLine(label = '', body = '') {
  const clean = normalizeText(body).replace(/\s+/g, ' ')
  if (!clean) return ''
  return `${label}｜${clean}`
}

function buildSectionBody(sentences = [], maxLength = 160, minLength = Math.max(40, Math.floor(maxLength * 0.45))) {
  let output = ''

  for (const sentence of sentences) {
    const next = output ? `${output}；${sentence}` : sentence
    if (next.length > maxLength && output.length >= minLength) break
    if (next.length > maxLength) {
      output = output
        ? `${output}；${clampSentence(sentence, Math.max(24, maxLength - output.length - 1))}`
        : clampSentence(sentence, maxLength)
      break
    }
    output = next
  }

  return output.trim()
}

function buildLocalSummary(job = {}, maxLength = JOB_SUMMARY_MAX_LENGTH, minLength = JOB_SUMMARY_MIN_LENGTH) {
  const seeds = [
    job.summary,
    job.description
  ]

  const source = seeds
    .map((value) => stripHtml(value))
    .find(Boolean) || ''

  if (!source) return '岗位亮点待补充，可结合 JD 核对后再生成配图。'

  const deduped = dedupeSentences(splitSummarySentences(source))

  if (deduped.length === 0) {
    return source.slice(0, maxLength)
  }

  const responsibilityPatterns = [
    /负责|参与|主导|推动|设计|开发|搭建|优化|管理|协作|支持|制定|落地|交付|lead|build|develop|drive|manage|deliver|partner/iu
  ]
  const requirementPatterns = [
    /要求|熟悉|经验|能力|背景|学历|技能|掌握|精通|理解|资格|擅长|need|require|qualification|proficient|experience|years?/iu
  ]
  const benefitPatterns = [
    /福利|待遇|薪资|奖金|期权|补贴|假期|年假|保险|津贴|远程|弹性|benefit|salary|bonus|equity|perk|pto|remote|flexible/iu
  ]

  const summarySentences = deduped.map((sentence) => clampSentence(sentence, 78))
  const used = new Set()
  const take = (patterns = [], count = 2, fallback = false) => {
    const picked = []
    for (const sentence of summarySentences) {
      if (used.has(sentence)) continue
      if (!fallback && !sentenceMatches(sentence, patterns)) continue
      picked.push(sentence)
      used.add(sentence)
      if (picked.length >= count) break
    }
    return picked
  }

  const overview = take(responsibilityPatterns, 2).concat(take([], 1, true)).slice(0, 3)
  const requirements = take(requirementPatterns, 2)
  const benefits = take(benefitPatterns, 2)
  const fallback = take([], 6, true)

  const sectionPairs = [
    ['岗位摘要', buildSectionBody(overview.length ? overview : fallback.slice(0, 2), 176, 88)],
    ['岗位要求', buildSectionBody(requirements.length ? requirements : fallback.slice(2, 4), 168, 72)],
    ['福利待遇', buildSectionBody(benefits.length ? benefits : fallback.slice(4, 6), 136, 40)]
  ].filter(([, body]) => Boolean(body))

  let output = sectionPairs
    .map(([label, body]) => buildSectionLine(label, body))
    .join('\n')

  if (output.length < minLength) {
    const extra = fallback.filter((sentence) => !output.includes(sentence))
    if (extra.length > 0 && sectionPairs.length > 0) {
      const lastIndex = sectionPairs.length - 1
      sectionPairs[lastIndex] = [
        sectionPairs[lastIndex][0],
        buildSectionBody(
          [...String(sectionPairs[lastIndex][1]).split('；').filter(Boolean), ...extra.slice(0, 2)],
          176,
          72
        )
      ]
      output = sectionPairs
        .map(([label, body]) => buildSectionLine(label, body))
        .join('\n')
    }
  }

  if (!output) {
    return source.slice(0, maxLength)
  }

  return output.slice(0, maxLength).trim()
}

function buildLocalCompanySummary(company = {}, maxLength = COMPANY_SUMMARY_MAX_LENGTH, minLength = COMPANY_SUMMARY_MIN_LENGTH) {
  const source = stripHtml(company.description)
  if (!source) return '企业简介待补充'

  const sentences = dedupeSentences(splitSummarySentences(source))

  let output = ''
  for (const sentence of sentences) {
    const next = output ? `${output} ${sentence}` : sentence
    if (next.length > maxLength && output.length >= minLength) break
    if (next.length > maxLength) {
      output = next.slice(0, maxLength)
      break
    }
    output = next
  }

  if (!output) {
    output = source.slice(0, maxLength)
  }

  return output.slice(0, maxLength).trim()
}

function shouldUseAiSummary({ localSummary = '', description = '' } = {}) {
  const cleanSummary = normalizeText(localSummary)
  const cleanDescription = stripHtml(description)

  if (!cleanDescription) return false
  if (!hasChinese(cleanSummary) && cleanDescription.length >= 80) return true
  if (!cleanSummary.includes('｜') && cleanDescription.length >= 180) return true
  if (cleanSummary.length < JOB_SUMMARY_MIN_LENGTH && cleanDescription.length >= 220) return true
  if (cleanSummary.length > JOB_SUMMARY_MAX_LENGTH) return true
  if (cleanDescription.length >= 560) return true
  if ((cleanDescription.match(/[•·▪●]/g) || []).length >= 6) return true
  return false
}

function shouldUseAiCompanySummary({ localSummary = '', description = '' } = {}) {
  const cleanSummary = normalizeText(localSummary)
  const cleanDescription = stripHtml(description)

  if (!cleanDescription) return false
  if (!hasChinese(cleanSummary) && cleanDescription.length >= 60) return true
  if (cleanSummary.length < COMPANY_SUMMARY_MIN_LENGTH && cleanDescription.length >= 90) return true
  if (cleanSummary.length > (COMPANY_SUMMARY_MAX_LENGTH + 6)) return true
  if (cleanDescription.length >= 180) return true
  return false
}

function buildShareJobId(jobId) {
  const normalized = String(jobId || '').trim()
  if (!normalized) return ''

  try {
    return Buffer.from(normalized, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch (_error) {
    return normalized
  }
}

function buildShareUrl(jobId) {
  const encoded = buildShareJobId(jobId)
  return `${DEFAULT_SITE_URL}/j/${encoded}?source=share`
}

async function ensureXiaohongshuDraftTable() {
  if (!neonHelper.isConfigured) return
  if (!globalThis[XHS_DRAFT_TABLE_READY]) {
    globalThis[XHS_DRAFT_TABLE_READY] = (async () => {
      await neonHelper.query(`
        CREATE TABLE IF NOT EXISTS admin_xhs_push_drafts (
          id BIGSERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL UNIQUE,
          template_version VARCHAR(50) NOT NULL DEFAULT '${DRAFT_TEMPLATE_VERSION}',
          theme_id VARCHAR(50),
          company_summary_text TEXT,
          job_summary_text TEXT,
          company_summary_source VARCHAR(50) NOT NULL DEFAULT 'local',
          job_summary_source VARCHAR(50) NOT NULL DEFAULT 'local',
          updated_by VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await neonHelper.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_xhs_push_drafts_updated_at
        ON admin_xhs_push_drafts(updated_at DESC)
      `)
      await neonHelper.query(`
        ALTER TABLE admin_xhs_push_drafts
          ADD COLUMN IF NOT EXISTS poster_title_text TEXT
      `)
      await neonHelper.query(`
        ALTER TABLE admin_xhs_push_drafts
          ADD COLUMN IF NOT EXISTS poster_title_source VARCHAR(50) NOT NULL DEFAULT 'original'
      `)
      await neonHelper.query(`
        CREATE TABLE IF NOT EXISTS admin_xhs_company_summaries (
          company_key VARCHAR(255) PRIMARY KEY,
          company_id VARCHAR(255),
          company_name TEXT NOT NULL,
          summary_text TEXT NOT NULL,
          summary_source VARCHAR(50) NOT NULL DEFAULT 'manual',
          updated_by VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await neonHelper.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_xhs_company_summaries_updated_at
        ON admin_xhs_company_summaries(updated_at DESC)
      `)
    })().catch((error) => {
      globalThis[XHS_DRAFT_TABLE_READY] = null
      throw error
    })
  }
  return globalThis[XHS_DRAFT_TABLE_READY]
}

function sanitizeDraftText(value, hardLimit) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, hardLimit)
}

function buildDraftPayload(row = {}) {
  const posterTitle = sanitizeDraftText(row.poster_title_text, 120)
  const companySummary = sanitizeDraftText(row.company_summary_text, 180)
  const jobSummary = sanitizeDraftText(row.job_summary_text, JOB_SUMMARY_HARD_LIMIT)
  if (!posterTitle && !companySummary && !jobSummary) return null

  return {
    posterTitle,
    posterTitleSource: normalizeText(row.poster_title_source, 'original'),
    companySummary,
    jobSummary,
    companySummarySource: normalizeText(row.company_summary_source, 'local'),
    jobSummarySource: normalizeText(row.job_summary_source, 'local'),
    themeId: normalizeText(row.theme_id),
    templateVersion: normalizeText(row.template_version, DRAFT_TEMPLATE_VERSION),
    updatedAt: row.draft_updated_at || row.updated_at || null,
    updatedBy: normalizeText(row.draft_updated_by),
    companySummaryScope: normalizeText(row.company_summary_scope, 'job'),
    provider: 'saved',
    saved: true
  }
}

function computeCompleteness(row, primaryContact) {
  let score = 0
  const missingFields = []

  const employeeCount = normalizeText(row.employee_count)
  const address = normalizeText(row.address)
  const foundedYear = normalizeText(row.founded_year)
  const companyRating = normalizeText(row.company_rating)
  const industry = normalizeText(row.industry || row.trusted_industry)
  const hasReferral = Boolean(primaryContact?.hiringEmail)

  if (employeeCount) score += 15
  else missingFields.push('employeeCount')

  if (address) score += 15
  else missingFields.push('address')

  if (foundedYear) score += 15
  else missingFields.push('foundedYear')

  if (companyRating) score += 15
  else missingFields.push('companyRating')

  if (industry) score += 10
  else missingFields.push('industry')

  if (hasReferral) score += 30
  else missingFields.push('referralContact')

  return {
    completenessScore: score,
    missingFields,
    hasReferralContact: hasReferral,
    hasCompanyMeta: Boolean(employeeCount || address || foundedYear || companyRating)
  }
}

function buildWhereClause(query = {}) {
  const conditions = [
    "j.status = 'active'",
    'COALESCE(j.is_approved, false) = true'
  ]
  const params = []
  let index = 1

  const search = normalizeText(query.search)
  if (search) {
    conditions.push(`(
      j.title ILIKE $${index}
      OR j.company ILIKE $${index}
      OR COALESCE(j.category, '') ILIKE $${index}
    )`)
    params.push(`%${search}%`)
    index += 1
  }

  const categories = normalizeArrayInput(query.category)
  if (categories.length > 0) {
    const sub = categories.map((value) => {
      const placeholder = `$${index++}`
      params.push(`%${value}%`)
      return `COALESCE(j.category, '') ILIKE ${placeholder}`
    })
    conditions.push(`(${sub.join(' OR ')})`)
  }

  const jobTypes = normalizeArrayInput(query.jobType)
  if (jobTypes.length > 0) {
    const sub = jobTypes.map((value) => {
      const normalized = value.toLowerCase()
      if (normalized === 'full-time') {
        const placeholders = [`$${index}`, `$${index + 1}`, `$${index + 2}`]
        params.push('%full%', '%全职%', '%正式%')
        index += 3
        return `(COALESCE(j.job_type, '') ILIKE ${placeholders[0]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[1]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[2]})`
      }
      if (normalized === 'part-time') {
        const placeholders = [`$${index}`, `$${index + 1}`]
        params.push('%part%', '%兼职%')
        index += 2
        return `(COALESCE(j.job_type, '') ILIKE ${placeholders[0]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[1]})`
      }
      if (normalized === 'contract') {
        const placeholders = [`$${index}`, `$${index + 1}`]
        params.push('%contract%', '%合同%')
        index += 2
        return `(COALESCE(j.job_type, '') ILIKE ${placeholders[0]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[1]})`
      }
      if (normalized === 'freelance') {
        const placeholders = [`$${index}`, `$${index + 1}`]
        params.push('%freelance%', '%自由职业%')
        index += 2
        return `(COALESCE(j.job_type, '') ILIKE ${placeholders[0]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[1]})`
      }
      if (normalized === 'internship') {
        const placeholders = [`$${index}`, `$${index + 1}`, `$${index + 2}`]
        params.push('%intern%', '%实习%', '%trainee%')
        index += 3
        return `(COALESCE(j.job_type, '') ILIKE ${placeholders[0]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[1]} OR COALESCE(j.job_type, '') ILIKE ${placeholders[2]})`
      }

      const placeholder = `$${index++}`
      params.push(`%${value}%`)
      return `COALESCE(j.job_type, '') ILIKE ${placeholder}`
    })
    conditions.push(`(${sub.join(' OR ')})`)
  }

  const levels = normalizeArrayInput(query.experienceLevel).map((item) => item.toLowerCase())
  if (levels.length > 0) {
    conditions.push(`LOWER(COALESCE(j.experience_level, '')) = ANY($${index})`)
    params.push(levels)
    index += 1
  }

  const industries = normalizeArrayInput(query.industry)
  if (industries.length > 0) {
    const sub = industries.map((value) => {
      const placeholder = `$${index++}`
      params.push(value)
      return `COALESCE(NULLIF(BTRIM(j.industry), ''), NULLIF(BTRIM(tc.industry), '')) ILIKE ${placeholder}`
    })
    conditions.push(`(${sub.join(' OR ')})`)
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

function normalizeSortMode(value) {
  const normalized = normalizeText(value, 'score').toLowerCase()
  if (['date', 'date_desc', 'recent', 'recent_desc', 'updated_at'].includes(normalized)) return 'date'
  return 'score'
}

function buildXiaohongshuOrderBy(sortMode, completenessSql) {
  if (sortMode === 'date') {
    return 'COALESCE(j.published_at, j.created_at) DESC, j.id DESC'
  }

  return `${completenessSql} DESC, COALESCE(j.published_at, j.created_at) DESC, j.id DESC`
}

async function getXiaohongshuFilterOptions() {
  const rows = await neonHelper.query(`
    SELECT json_build_object(
      'categories',
      COALESCE((
        SELECT json_agg(category ORDER BY LOWER(category))
        FROM (
          SELECT DISTINCT BTRIM(j.category) AS category
          FROM jobs j
          WHERE j.status = 'active'
            AND COALESCE(j.is_approved, false) = true
            AND NULLIF(BTRIM(j.category), '') IS NOT NULL
        ) category_values
      ), '[]'::json),
      'industries',
      COALESCE((
        SELECT json_agg(industry ORDER BY LOWER(industry))
        FROM (
          SELECT DISTINCT COALESCE(NULLIF(BTRIM(j.industry), ''), NULLIF(BTRIM(tc.industry), '')) AS industry
          FROM jobs j
          LEFT JOIN trusted_companies tc
            ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
          WHERE j.status = 'active'
            AND COALESCE(j.is_approved, false) = true
            AND COALESCE(NULLIF(BTRIM(j.industry), ''), NULLIF(BTRIM(tc.industry), '')) IS NOT NULL
        ) industry_values
      ), '[]'::json)
    ) AS filter_options
  `)

  const rawOptions = safeParseJson(rows?.[0]?.filter_options, {})
  return {
    categories: Array.isArray(rawOptions?.categories) ? rawOptions.categories.map((item) => normalizeText(item)).filter(Boolean) : [],
    industries: Array.isArray(rawOptions?.industries) ? rawOptions.industries.map((item) => normalizeText(item)).filter(Boolean) : []
  }
}

async function requireAdmin(req) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  const isAdmin = Boolean(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(String(requester?.email || '').toLowerCase()))

  return {
    ok: Boolean(payload && isAdmin),
    payload,
    requester
  }
}

export async function assertAdminRequest(req, res) {
  const auth = await requireAdmin(req)

  if (!auth.payload) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return null
  }

  if (!auth.ok) {
    res.status(403).json({ success: false, error: 'Forbidden' })
    return null
  }

  return auth
}

export function setAdminJsonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export async function getXiaohongshuJobList(query = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }
  await ensureXiaohongshuDraftTable()

  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50)
  const offset = (page - 1) * limit
  const sortMode = normalizeSortMode(query.sort)

  const { where, params } = buildWhereClause(query)
  const completenessSql = `
    (
      CASE WHEN COALESCE(NULLIF(BTRIM(tc.employee_count), ''), NULL) IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN COALESCE(NULLIF(BTRIM(tc.address), ''), NULL) IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN COALESCE(NULLIF(BTRIM(tc.founded_year), ''), NULL) IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN COALESCE(NULLIF(BTRIM(tc.company_rating), ''), NULL) IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN COALESCE(NULLIF(BTRIM(j.industry), ''), NULLIF(BTRIM(tc.industry), '')) IS NOT NULL THEN 10 ELSE 0 END +
      CASE
        WHEN COALESCE(jsonb_array_length(COALESCE(tc.referral_contacts, '[]'::jsonb)), 0) > 0
          OR COALESCE(NULLIF(BTRIM(tc.hiring_email), ''), NULL) IS NOT NULL
        THEN 30
        ELSE 0
      END
    )
  `

  const countRows = await neonHelper.query(
    `SELECT COUNT(*) AS count
     FROM jobs j
     LEFT JOIN trusted_companies tc
       ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
     ${where}`,
    params
  )

  const total = Number.parseInt(countRows?.[0]?.count || '0', 10)
  const filterOptions = await getXiaohongshuFilterOptions()
  const orderBy = buildXiaohongshuOrderBy(sortMode, completenessSql)

  const rows = await neonHelper.query(
    `SELECT
        j.job_id,
        j.title,
        j.company,
        j.url,
        j.location,
        j.category,
        j.job_type,
        j.experience_level,
        j.description,
        j.translations,
        j.published_at,
        j.updated_at,
        j.created_at,
        j.industry,
        j.company_id,
        j.referral_contact_mode,
        tc.employee_count,
        tc.address,
        tc.founded_year,
        tc.company_rating,
        tc.industry AS trusted_industry,
        tc.description AS company_description,
        tc.logo AS company_logo,
        tc.translations AS company_translations,
        tc.referral_contacts,
        tc.hiring_email,
        tc.email_type,
        xd.poster_title_text,
        xd.poster_title_source,
        COALESCE(xd.company_summary_text, xcs.summary_text) AS company_summary_text,
        xd.job_summary_text,
        COALESCE(xd.company_summary_source, xcs.summary_source) AS company_summary_source,
        CASE
          WHEN xd.company_summary_text IS NOT NULL AND xd.company_summary_source <> 'company' THEN 'job'
          WHEN xcs.company_key IS NOT NULL OR xd.company_summary_source = 'company' THEN 'company'
          ELSE 'job'
        END AS company_summary_scope,
        xd.job_summary_source,
        xd.theme_id,
        xd.template_version,
        xd.updated_at AS draft_updated_at,
        xd.updated_by AS draft_updated_by,
        COALESCE(jrcl.selected_referral_contact_ids, ARRAY[]::text[]) AS selected_referral_contact_ids,
        ${completenessSql} AS completeness_score
     FROM jobs j
     LEFT JOIN trusted_companies tc
       ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
     LEFT JOIN (
       SELECT job_id,
              array_agg(contact_id ORDER BY contact_id) AS selected_referral_contact_ids
       FROM job_referral_contact_links
       GROUP BY job_id
     ) jrcl
       ON jrcl.job_id = CAST(j.job_id AS VARCHAR)
     LEFT JOIN admin_xhs_push_drafts xd
       ON xd.job_id = CAST(j.job_id AS VARCHAR)
     LEFT JOIN admin_xhs_company_summaries xcs
       ON xcs.company_key = CASE
         WHEN NULLIF(BTRIM(CAST(j.company_id AS VARCHAR)), '') IS NOT NULL
           THEN 'id:' || LOWER(BTRIM(CAST(j.company_id AS VARCHAR)))
         ELSE 'name:' || LOWER(BTRIM(j.company))
       END
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  )

  const items = (rows || []).map((row) => {
    const jobTranslations = safeParseJson(row.translations, {})
    const companyTranslations = safeParseJson(row.company_translations, {})
    const allContacts = normalizeReferralContacts(row.referral_contacts, row.hiring_email, row.email_type)
    const selectedIds = new Set(
      (Array.isArray(row.selected_referral_contact_ids) ? row.selected_referral_contact_ids : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
    const isCustomReferralMode = normalizeText(row.referral_contact_mode, 'inherit_all').toLowerCase() === 'custom'
    const contacts = isCustomReferralMode
      ? allContacts.filter((contact) => selectedIds.has(normalizeText(contact?.id)))
      : allContacts
    const primaryContact = pickPrimaryReferralContact(contacts)
    const effectiveHiringEmail = normalizeText(primaryContact?.hiringEmail)
    const effectiveEmailType = normalizeEmailTypeLabel(primaryContact?.emailType, normalizeEmailTypeLabel(row.email_type))
    const companyInfoCompact = formatCompactField([
      row.employee_count,
      row.address,
      row.founded_year ? `${row.founded_year}年` : '',
      row.company_rating
    ])
    const referralInfoCompact = formatCompactField([
      primaryContact?.name,
      primaryContact?.title,
      primaryContact?.hiringEmail
    ])
    const completeness = computeCompleteness(row, primaryContact)
    const displayTitle = preferChinese(jobTranslations?.title, row.title)
    const displayCompany = preferChinese(jobTranslations?.company, row.company)
    const displayLocation = preferChinese(jobTranslations?.location, row.location)
    const displayCategory = preferChinese(jobTranslations?.category || jobTranslations?.role, row.category)
    const displayJobType = preferChinese(jobTranslations?.jobType || jobTranslations?.job_type, row.job_type)
    const displayExperienceLevel = preferChinese(jobTranslations?.experienceLevel || jobTranslations?.experience_level, row.experience_level)
    const displayDescription = preferChinese(jobTranslations?.description, row.description)
    const displayIndustry = preferChinese(jobTranslations?.industry, row.industry || row.trusted_industry)
    const canonicalCompanyDescription = normalizeText(row.company_description)
    const displayCompanyDescription = canonicalCompanyDescription || preferChinese(companyTranslations?.description, row.company_description)
    const displayAddress = preferChinese(companyTranslations?.address || companyTranslations?.headquarters, row.address)
    const draft = buildDraftPayload(row)

    return {
      id: String(row.job_id),
      companyId: normalizeText(row.company_id),
      companyKey: normalizeText(row.company_id)
        ? `id:${normalizeText(row.company_id).toLowerCase()}`
        : `name:${normalizeText(row.company).toLowerCase()}`,
      title: normalizeText(displayTitle, '未命名岗位'),
      company: normalizeText(displayCompany, '未知企业'),
      location: normalizeText(displayLocation, '地点待补充'),
      category: normalizeText(displayCategory, '角色待补充'),
      jobType: normalizeText(displayJobType, '类型待补充'),
      experienceLevel: normalizeText(displayExperienceLevel, '级别待补充'),
      description: normalizeText(displayDescription),
      updatedAt: row.published_at || row.created_at || null,
      shareUrl: buildShareUrl(row.job_id),
      applicationUrl: normalizeText(row.url),
      employeeCount: normalizeText(row.employee_count, '待补充'),
      address: normalizeText(displayAddress, '待补充'),
      foundedYear: normalizeText(row.founded_year ? `${row.founded_year}年` : '', '待补充'),
      companyRating: normalizeText(row.company_rating, '待补充'),
      industry: normalizeText(displayIndustry, '待补充'),
      logo: normalizeText(row.company_logo),
      companyDescription: normalizeText(displayCompanyDescription),
      canonicalCompanyDescription: normalizeText(canonicalCompanyDescription || displayCompanyDescription),
      companyDescriptionSource: canonicalCompanyDescription ? 'trusted' : (normalizeText(displayCompanyDescription) ? 'translation' : 'empty'),
      hiringEmail: effectiveHiringEmail,
      emailType: effectiveEmailType,
      referralContacts: contacts,
      companyInfoCompact,
      referralInfoCompact,
      referralInfoBlock: contacts.length > 0 ? contacts.map((contact) => formatTypedReferralLine(contact)).join('\n') : '通用邮箱：待补充｜待补充：待补充',
      completenessScore: Number(row.completeness_score ?? completeness.completenessScore),
      missingFields: completeness.missingFields,
      hasReferralContact: completeness.hasReferralContact,
      hasCompanyMeta: completeness.hasCompanyMeta,
      draft
    }
  })

  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
    sort: sortMode,
    filterOptions
  }
}

async function callBailianTextSummary({ systemPrompt, prompt, maxTokens = 180 }) {
  const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY
  if (!apiKey) {
    throw new Error('Bailian API key not configured')
  }

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: maxTokens
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || 'Bailian summary request failed')
  }

  const content = normalizeText(data?.choices?.[0]?.message?.content || data?.output?.text || '')
  return {
    content
  }
}

function compactSource(value, maxLength) {
  const clean = stripHtml(value)
    .replace(/\b(cookie|privacy policy|equal opportunity employer)\b[^。.!?]{0,240}/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= maxLength) return clean
  return clean.slice(0, maxLength).replace(/[，,；;、:：\s]+$/u, '')
}

function parseSummaryJson(value) {
  const clean = normalizeText(value)
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return safeParseJson(clean.slice(start, end + 1), null)
}

function sanitizeAiCompanySummary(value, fallback) {
  const clean = sanitizeDraftText(value, 180)
    .replace(/^(企业简介|公司简介)[｜|：:]\s*/u, '')
    .replace(/\s*\n\s*/g, ' ')
  if (!clean || clean.length < 36 || clean.length > 140 || !hasChinese(clean)) return fallback
  return clean
}

function sanitizeAiJobSummary(value, fallback) {
  const allowedLabels = new Set(['岗位摘要', '岗位要求', '福利待遇', '团队亮点'])
  const lines = sanitizeDraftText(value, JOB_SUMMARY_HARD_LIMIT)
    .replace(/\s*(?=(?:岗位摘要|岗位要求|福利待遇|团队亮点)\s*[｜|：:])/gu, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(岗位摘要|岗位要求|福利待遇|团队亮点)\s*[｜|：:]\s*(.+)$/u)
      return match ? `${match[1]}｜${match[2].trim()}` : ''
    })
    .filter(Boolean)
  const uniqueLines = lines.filter((line, index) => {
    const label = line.split('｜')[0]
    return allowedLabels.has(label) && lines.findIndex((item) => item.startsWith(`${label}｜`)) === index
  })
  const clean = uniqueLines.slice(0, 3).join('\n')
  if (!clean || uniqueLines.length < 2 || clean.length < 120 || clean.length > JOB_SUMMARY_HARD_LIMIT || !hasChinese(clean)) return fallback
  return clean
}

export async function generateXiaohongshuSummary(payload = {}) {
  const job = {
    id: normalizeText(payload.id),
    title: normalizeText(payload.title),
    company: normalizeText(payload.company),
    location: normalizeText(payload.location),
    category: normalizeText(payload.category),
    jobType: normalizeText(payload.jobType),
    experienceLevel: normalizeText(payload.experienceLevel),
    description: normalizeText(payload.description),
    summary: normalizeText(payload.summary),
    companyDescription: normalizeText(payload.companyDescription || payload.canonicalCompanyDescription),
    updatedAt: normalizeText(payload.updatedAt)
  }
  if (!job.id || !job.description) {
    throw new Error('岗位信息不完整，暂时无法生成摘要')
  }

  const localSummary = buildLocalSummary(job, JOB_SUMMARY_MAX_LENGTH, JOB_SUMMARY_MIN_LENGTH)
  const localCompanySummary = buildLocalCompanySummary({ description: job.companyDescription }, COMPANY_SUMMARY_MAX_LENGTH, COMPANY_SUMMARY_MIN_LENGTH)
  const reusedCompanySummary = sanitizeDraftText(payload.reuseCompanySummary, 180)
  const shouldGenerateCompany = !reusedCompanySummary
  const cacheKey = [
    SUMMARY_TEMPLATE_VERSION,
    job.id || 'unknown',
    job.updatedAt || 'unknown',
    Buffer.from(`${localSummary}::${reusedCompanySummary || localCompanySummary}`).toString('base64').slice(0, 48)
  ].join(':')

  if (!payload.force && SUMMARY_CACHE.has(cacheKey)) {
    return {
      ...SUMMARY_CACHE.get(cacheKey),
      cacheHit: true
    }
  }

  let result = {
    jobSummary: localSummary,
    companySummary: reusedCompanySummary || localCompanySummary,
    provider: 'local',
    jobSummarySource: 'local',
    companySummarySource: reusedCompanySummary ? 'company' : 'canonical',
    usedFallback: false,
    cacheHit: false,
    model: SUMMARY_MODEL
  }

  try {
    const outputShape = shouldGenerateCompany
      ? '{"companySummary":"60-110字企业简介","jobSummary":"2-3行岗位摘要"}'
      : '{"jobSummary":"2-3行岗位摘要"}'
    const prompt = [
      '请根据原始资料生成小红书招聘海报文案。只输出一个可解析的 JSON 对象，不要 Markdown。',
      `输出结构：${outputShape}`,
      '岗位摘要规则：',
      '- 只保留原文中能核实的信息，禁止补全、夸张或使用“值得加入”等空话。',
      '- 输出 2-3 行，每行格式为“小标题｜内容”；小标题仅限岗位摘要、岗位要求、福利待遇、团队亮点。',
      '- 优先覆盖具体职责、必备技能/年限、明确福利；原文没有福利时不要生成福利待遇。',
      '- 总长度 160-360 个中文字符，每行尽量 55-100 字；句子短、信息密度高，避免重复岗位标题和企业名称。',
      ...(shouldGenerateCompany ? [
        '企业简介规则：',
        '- 60-110 个中文字符，只写企业定位、产品/服务、客户或差异化事实。',
        '- 不加标题，不写招聘口号；英文原文需自然翻译为中文。'
      ] : []),
      '',
      `岗位元数据：${JSON.stringify({ title: job.title, company: job.company, location: job.location, category: job.category, jobType: job.jobType, experienceLevel: job.experienceLevel })}`,
      `岗位原文：${compactSource(job.description, 5200)}`,
      ...(shouldGenerateCompany ? [`企业原文：${compactSource(job.companyDescription, 1600)}`] : [])
    ].join('\n')

    const aiResponse = await callBailianTextSummary({
      systemPrompt: '你是严谨的招聘内容编辑。你只能压缩和翻译提供的事实，并严格按用户指定的 JSON 结构输出。',
      prompt,
      maxTokens: shouldGenerateCompany ? 520 : 420
    })
    const parsed = parseSummaryJson(aiResponse.content)
    const aiJobSummary = sanitizeAiJobSummary(parsed?.jobSummary, localSummary)
    const aiCompanySummary = shouldGenerateCompany
      ? sanitizeAiCompanySummary(parsed?.companySummary, localCompanySummary)
      : reusedCompanySummary
    const rawAiJobSummary = sanitizeDraftText(parsed?.jobSummary, JOB_SUMMARY_HARD_LIMIT)
    const jobFallback = aiJobSummary === localSummary
    const companyFallback = shouldGenerateCompany && aiCompanySummary === localCompanySummary

    result = {
      ...result,
      jobSummary: aiJobSummary,
      companySummary: aiCompanySummary || localCompanySummary,
      provider: jobFallback && (!shouldGenerateCompany || companyFallback) ? 'local' : 'bailian',
      jobSummarySource: jobFallback ? 'local' : 'ai',
      companySummarySource: reusedCompanySummary ? 'company' : (companyFallback ? 'canonical' : 'ai'),
      usedFallback: jobFallback || companyFallback,
      error: !parsed
        ? 'AI 返回格式异常，已使用本地摘要兜底'
        : (jobFallback ? `AI 岗位摘要未通过结构校验（${rawAiJobSummary.length} 字），已使用本地摘要兜底` : undefined)
    }
  } catch (error) {
    result = {
      ...result,
      usedFallback: true,
      error: error instanceof Error ? error.message : '摘要生成失败'
    }
  }

  SUMMARY_CACHE.set(cacheKey, result)
  return result
}

export async function saveXiaohongshuDraft(payload = {}, admin = null) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }
  await ensureXiaohongshuDraftTable()

  const jobId = normalizeText(payload.jobId || payload.id)
  if (!jobId) {
    throw new Error('jobId is required')
  }

  const companySummary = sanitizeDraftText(payload.companySummary, 180)
  const jobSummary = sanitizeDraftText(payload.jobSummary, JOB_SUMMARY_HARD_LIMIT)
  const posterTitle = sanitizeDraftText(payload.posterTitle, 120)
  if (!companySummary || !jobSummary) {
    throw new Error('companySummary and jobSummary are required')
  }

  const updatedBy = normalizeText(admin?.requester?.email || admin?.payload?.userId || payload.updatedBy, 'system')

  const result = await neonHelper.query(
    `INSERT INTO admin_xhs_push_drafts (
        job_id,
        template_version,
        theme_id,
        poster_title_text,
        poster_title_source,
        company_summary_text,
        job_summary_text,
        company_summary_source,
        job_summary_source,
        updated_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (job_id) DO UPDATE SET
        template_version = EXCLUDED.template_version,
        theme_id = EXCLUDED.theme_id,
        poster_title_text = EXCLUDED.poster_title_text,
        poster_title_source = EXCLUDED.poster_title_source,
        company_summary_text = EXCLUDED.company_summary_text,
        job_summary_text = EXCLUDED.job_summary_text,
        company_summary_source = EXCLUDED.company_summary_source,
        job_summary_source = EXCLUDED.job_summary_source,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING
        job_id,
        template_version,
        theme_id,
        poster_title_text,
        poster_title_source,
        company_summary_text,
        job_summary_text,
        company_summary_source,
        job_summary_source,
        updated_at AS draft_updated_at,
        updated_by AS draft_updated_by`,
    [
      jobId,
      normalizeText(payload.templateVersion, DRAFT_TEMPLATE_VERSION),
      normalizeText(payload.themeId),
      posterTitle,
      normalizeText(payload.posterTitleSource, posterTitle ? 'manual' : 'original'),
      companySummary,
      jobSummary,
      normalizeText(payload.companySummarySource, 'manual'),
      normalizeText(payload.jobSummarySource, 'manual'),
      updatedBy
    ]
  )

  let appliedToCompany = false
  let affectedJobCount = 0
  if (payload.applyCompanySummaryToAll) {
    const companyRows = await neonHelper.query(
      `SELECT CAST(company_id AS VARCHAR) AS company_id, company
       FROM jobs
       WHERE CAST(job_id AS VARCHAR) = $1
       LIMIT 1`,
      [jobId]
    )
    const companyRow = companyRows?.[0]
    if (!companyRow) throw new Error('未找到岗位对应企业，无法应用到全部')

    const companyId = normalizeText(companyRow.company_id)
    const companyName = normalizeText(companyRow.company, '未知企业')
    const companyKey = companyId
      ? `id:${companyId.toLowerCase()}`
      : `name:${companyName.toLowerCase()}`

    const affectedRows = await neonHelper.query(
      `WITH company_upsert AS (
         INSERT INTO admin_xhs_company_summaries (
           company_key, company_id, company_name, summary_text, summary_source, updated_by, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (company_key) DO UPDATE SET
           company_id = EXCLUDED.company_id,
           company_name = EXCLUDED.company_name,
           summary_text = EXCLUDED.summary_text,
           summary_source = EXCLUDED.summary_source,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING company_key
       ), updated_drafts AS (
         UPDATE admin_xhs_push_drafts xd
         SET company_summary_text = $4,
             company_summary_source = 'company',
             updated_by = $6,
             updated_at = NOW()
         FROM jobs j
         WHERE xd.job_id = CAST(j.job_id AS VARCHAR)
           AND CASE
             WHEN NULLIF(BTRIM(CAST(j.company_id AS VARCHAR)), '') IS NOT NULL
               THEN 'id:' || LOWER(BTRIM(CAST(j.company_id AS VARCHAR)))
             ELSE 'name:' || LOWER(BTRIM(j.company))
           END = $1
         RETURNING xd.job_id
       )
       SELECT
         COUNT(*) AS count,
         (SELECT COUNT(*) FROM updated_drafts) AS updated_draft_count,
         (SELECT COUNT(*) FROM company_upsert) AS upserted_company_count
       FROM jobs
       WHERE status = 'active'
         AND COALESCE(is_approved, false) = true
         AND CASE
           WHEN NULLIF(BTRIM(CAST(company_id AS VARCHAR)), '') IS NOT NULL
             THEN 'id:' || LOWER(BTRIM(CAST(company_id AS VARCHAR)))
           ELSE 'name:' || LOWER(BTRIM(company))
         END = $1`,
      [
        companyKey,
        companyId || null,
        companyName,
        companySummary,
        normalizeText(payload.companySummarySource, 'manual'),
        updatedBy
      ]
    )
    affectedJobCount = Number.parseInt(affectedRows?.[0]?.count || '0', 10)
    appliedToCompany = true
  }

  const draft = buildDraftPayload({
    ...(result?.[0] || {}),
    company_summary_source: appliedToCompany ? 'company' : result?.[0]?.company_summary_source,
    company_summary_scope: appliedToCompany || normalizeText(payload.companySummarySource) === 'company' ? 'company' : 'job'
  })

  return { draft, appliedToCompany, affectedJobCount }
}

export {
  DRAFT_TEMPLATE_VERSION,
  SUMMARY_TEMPLATE_VERSION,
  buildLocalSummary,
  buildLocalCompanySummary,
  normalizeEmailTypeLabel,
  shouldUseAiSummary,
  shouldUseAiCompanySummary
}
