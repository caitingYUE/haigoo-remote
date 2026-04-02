import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

const DEFAULT_SITE_URL = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
const SUMMARY_MODEL = process.env.ALIBABA_BAILIAN_SUMMARY_MODEL || process.env.ALIBABA_BAILIAN_MODEL || 'qwen-turbo'
const SUMMARY_TEMPLATE_VERSION = 'xhs-v2'
const DRAFT_TEMPLATE_VERSION = 'xhs-v1'
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

function buildLocalSummary(job = {}, maxLength = 186, minLength = 146) {
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

  const bullets = []
  for (const sentence of deduped) {
    const candidate = `${bullets.length + 1}. ${clampSentence(sentence, 42)}`
    const next = [...bullets, candidate].join('\n')
    if (next.length > maxLength && bullets.join('\n').length >= minLength) break
    if (next.length > maxLength) {
      bullets.push(`${bullets.length + 1}. ${clampSentence(sentence, 30)}`)
      break
    }
    bullets.push(candidate)
    if (bullets.length >= 4 && bullets.join('\n').length >= minLength) break
  }

  if (bullets.length === 0) {
    return source.slice(0, maxLength)
  }

  return bullets.join('\n').slice(0, maxLength).trim()
}

function buildLocalCompanySummary(company = {}, maxLength = 78, minLength = Math.max(48, Math.floor(maxLength * 0.66))) {
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
  if (!cleanSummary.includes('\n') && cleanDescription.length >= 140) return true
  if (cleanSummary.length < 140 && cleanDescription.length >= 180) return true
  if (cleanSummary.length > 186) return true
  if (cleanDescription.length >= 560) return true
  if ((cleanDescription.match(/[•·▪●]/g) || []).length >= 6) return true
  return false
}

function shouldUseAiCompanySummary({ localSummary = '', description = '' } = {}) {
  const cleanSummary = normalizeText(localSummary)
  const cleanDescription = stripHtml(description)

  if (!cleanDescription) return false
  if (!hasChinese(cleanSummary) && cleanDescription.length >= 60) return true
  if (cleanSummary.length < 48 && cleanDescription.length >= 90) return true
  if (cleanSummary.length > 82) return true
  if (cleanDescription.length >= 180) return true
  return false
}

function buildShareJobId(jobId) {
  const normalized = String(jobId || '').trim()
  if (!normalized) return ''

  try {
    const encoded = Buffer.from(normalized, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    return `E-${encoded}`
  } catch (_error) {
    return normalized
  }
}

function buildShareUrl(jobId) {
  const encoded = buildShareJobId(jobId)
  return `${DEFAULT_SITE_URL}/job/${encoded}?source=share`
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
  const companySummary = sanitizeDraftText(row.company_summary_text, 180)
  const jobSummary = sanitizeDraftText(row.job_summary_text, 360)
  if (!companySummary && !jobSummary) return null

  return {
    companySummary,
    jobSummary,
    companySummarySource: normalizeText(row.company_summary_source, 'local'),
    jobSummarySource: normalizeText(row.job_summary_source, 'local'),
    themeId: normalizeText(row.theme_id),
    templateVersion: normalizeText(row.template_version, DRAFT_TEMPLATE_VERSION),
    updatedAt: row.draft_updated_at || row.updated_at || null,
    updatedBy: normalizeText(row.draft_updated_by),
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
      params.push(value)
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

async function requireAdmin(req) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  const isAdmin = Boolean(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(requester?.email))

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

  const rows = await neonHelper.query(
    `SELECT
        j.job_id,
        j.title,
        j.company,
        j.location,
        j.category,
        j.job_type,
        j.experience_level,
        j.description,
        j.translations,
        j.updated_at,
        j.created_at,
        j.industry,
        j.company_id,
        tc.employee_count,
        tc.address,
        tc.founded_year,
        tc.company_rating,
        tc.industry AS trusted_industry,
        tc.description AS company_description,
        tc.translations AS company_translations,
        tc.referral_contacts,
        tc.hiring_email,
        tc.email_type,
        xd.company_summary_text,
        xd.job_summary_text,
        xd.company_summary_source,
        xd.job_summary_source,
        xd.theme_id,
        xd.template_version,
        xd.updated_at AS draft_updated_at,
        xd.updated_by AS draft_updated_by,
        ${completenessSql} AS completeness_score
     FROM jobs j
     LEFT JOIN trusted_companies tc
       ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
     LEFT JOIN admin_xhs_push_drafts xd
       ON xd.job_id = CAST(j.job_id AS VARCHAR)
     ${where}
     ORDER BY ${completenessSql} DESC, COALESCE(j.updated_at, j.created_at) DESC, j.id DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  )

  const items = (rows || []).map((row) => {
    const jobTranslations = safeParseJson(row.translations, {})
    const companyTranslations = safeParseJson(row.company_translations, {})
    const contacts = normalizeReferralContacts(row.referral_contacts, row.hiring_email, row.email_type)
    const primaryContact = pickPrimaryReferralContact(contacts)
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
    const referralInfoBlock = contacts.length > 0
      ? contacts.map((contact) => formatReferralLine(contact)).join('\n')
      : '待补充｜待补充：待补充'

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
      title: normalizeText(displayTitle, '未命名岗位'),
      company: normalizeText(displayCompany, '未知企业'),
      location: normalizeText(displayLocation, '地点待补充'),
      category: normalizeText(displayCategory, '角色待补充'),
      jobType: normalizeText(displayJobType, '类型待补充'),
      experienceLevel: normalizeText(displayExperienceLevel, '级别待补充'),
      description: normalizeText(displayDescription),
      updatedAt: row.updated_at || row.created_at || null,
      shareUrl: buildShareUrl(row.job_id),
      employeeCount: normalizeText(row.employee_count, '待补充'),
      address: normalizeText(displayAddress, '待补充'),
      foundedYear: normalizeText(row.founded_year ? `${row.founded_year}年` : '', '待补充'),
      companyRating: normalizeText(row.company_rating, '待补充'),
      industry: normalizeText(displayIndustry, '待补充'),
      companyDescription: normalizeText(displayCompanyDescription),
      canonicalCompanyDescription: normalizeText(canonicalCompanyDescription || displayCompanyDescription),
      companyDescriptionSource: canonicalCompanyDescription ? 'trusted' : (normalizeText(displayCompanyDescription) ? 'translation' : 'empty'),
      hiringEmail: normalizeText(row.hiring_email),
      emailType: normalizeEmailTypeLabel(row.email_type),
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
    sort: normalizeText(query.sort, 'info_complete,recent')
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

  const localSummary = buildLocalSummary(job, 186)
  const localCompanySummary = buildLocalCompanySummary({ description: job.companyDescription }, 78)
  const cacheKey = [
    SUMMARY_TEMPLATE_VERSION,
    job.id || 'unknown',
    job.updatedAt || 'unknown',
    Buffer.from(`${localSummary}::${localCompanySummary}`).toString('base64').slice(0, 48)
  ].join(':')

  if (SUMMARY_CACHE.has(cacheKey)) {
    return {
      ...SUMMARY_CACHE.get(cacheKey),
      cacheHit: true
    }
  }

  let result = {
    jobSummary: localSummary,
    companySummary: localCompanySummary,
    provider: 'local',
    jobSummarySource: 'local',
    companySummarySource: 'canonical',
    usedFallback: false,
    cacheHit: false
  }

  if (shouldUseAiSummary({ localSummary, description: job.description })) {
    try {
      const prompt = [
        '请将下面岗位信息压缩为适合 3:4 招聘海报展示的中文岗位摘要。',
        '要求：',
        '1. 输出 3 到 4 条要点，每条单独一行，使用 1. / 2. / 3. 开头。',
        '2. 总长度控制在 140 到 188 个中文字符内，尽量铺满海报摘要区域。',
        '3. 覆盖核心职责、关键要求、业务或团队亮点，不要虚构信息。',
        '4. 每条尽量简洁有信息密度，适合社媒岗位卡直接展示。',
        '',
        `岗位标题：${normalizeText(job.title)}`,
        `企业名称：${normalizeText(job.company)}`,
        `岗位地点：${normalizeText(job.location)}`,
        `岗位角色：${normalizeText(job.category)}`,
        `岗位类型：${normalizeText(job.jobType)}`,
        `岗位级别：${normalizeText(job.experienceLevel)}`,
        `本地摘要候选：${normalizeText(localSummary)}`,
        `岗位详情：${stripHtml(job.description)}`
      ].join('\n')

      const aiJob = await callBailianTextSummary({
        systemPrompt: '你是一个招聘运营文案压缩助手，只负责将岗位详情压缩成适合社媒海报展示的中文要点摘要。',
        prompt,
        maxTokens: 260
      })

      result = {
        ...result,
        jobSummary: normalizeText(aiJob.content, localSummary),
        provider: 'bailian',
        jobSummarySource: 'ai',
        usedFallback: !normalizeText(aiJob.content)
      }
    } catch (error) {
      result = {
        ...result,
        provider: 'local',
        jobSummarySource: 'local',
        usedFallback: true,
        cacheHit: false,
        error: error instanceof Error ? error.message : 'Summary generation failed'
      }
    }
  }

  if (shouldUseAiCompanySummary({ localSummary: localCompanySummary, description: job.companyDescription })) {
    try {
      const prompt = [
        '请将下面企业简介压缩为适合岗位海报展示的中文简介。',
        '要求：',
        '1. 只输出一段中文，不要加标题、序号、引号。',
        '2. 保留企业定位、产品或服务对象、最有辨识度的信息。',
        '3. 控制在 48 到 78 个中文字符内，尽量铺满企业简介区域但不要空话。',
        '4. 如果原文是英文，也请直接输出自然中文。',
        '',
        `企业名称：${normalizeText(job.company)}`,
        `本地摘要候选：${localCompanySummary}`,
        `企业简介：${stripHtml(job.companyDescription)}`
      ].join('\n')

      const aiCompany = await callBailianTextSummary({
        systemPrompt: '你是一个招聘运营文案压缩助手，只负责将企业简介压缩为适合社媒岗位海报展示的自然中文介绍。',
        prompt,
        maxTokens: 120
      })

      result = {
        ...result,
        companySummary: normalizeText(aiCompany.content, result.companySummary),
        companySummarySource: 'ai',
        provider: result.provider === 'bailian' ? 'bailian' : 'bailian'
      }
    } catch (error) {
      result = {
        ...result,
        usedFallback: true,
        error: result.error || (error instanceof Error ? error.message : 'Company summary generation failed')
      }
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
  const jobSummary = sanitizeDraftText(payload.jobSummary, 360)
  if (!companySummary || !jobSummary) {
    throw new Error('companySummary and jobSummary are required')
  }

  const result = await neonHelper.query(
    `INSERT INTO admin_xhs_push_drafts (
        job_id,
        template_version,
        theme_id,
        company_summary_text,
        job_summary_text,
        company_summary_source,
        job_summary_source,
        updated_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (job_id) DO UPDATE SET
        template_version = EXCLUDED.template_version,
        theme_id = EXCLUDED.theme_id,
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
      companySummary,
      jobSummary,
      normalizeText(payload.companySummarySource, 'manual'),
      normalizeText(payload.jobSummarySource, 'manual'),
      normalizeText(admin?.requester?.email || admin?.payload?.userId || payload.updatedBy, 'system')
    ]
  )

  return buildDraftPayload(result?.[0] || {})
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
