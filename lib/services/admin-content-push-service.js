import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

const DEFAULT_SITE_URL = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
const SUMMARY_MODEL = process.env.ALIBABA_BAILIAN_MODEL || 'qwen-plus'
const SUMMARY_TEMPLATE_VERSION = 'xhs-v1'

if (!globalThis.__haigoo_xhs_summary_cache) {
  globalThis.__haigoo_xhs_summary_cache = new Map()
}

const SUMMARY_CACHE = globalThis.__haigoo_xhs_summary_cache

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
      emailType: normalizeText(item?.emailType || fallbackEmailType)
    }))
    .filter((item) => item.name || item.title || item.hiringEmail)

  if (normalized.length > 0) return normalized

  const fallbackEmail = normalizeText(fallbackHiringEmail)
  if (!fallbackEmail) return []

  return [{
    name: '',
    title: '',
    hiringEmail: fallbackEmail,
    emailType: normalizeText(fallbackEmailType)
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

function buildLocalSummary(job = {}, maxLength = 110, minLength = Math.max(72, Math.floor(maxLength * 0.72))) {
  const seeds = [
    job.summary,
    job.description
  ]

  const source = seeds
    .map((value) => stripHtml(value))
    .find(Boolean) || ''

  if (!source) return '岗位亮点待补充，可结合 JD 核对后再生成配图。'

  const sentences = source
    .split(/(?<=[。！？!?.；;])/)
    .map((item) => item.trim())
    .filter(Boolean)

  const deduped = []
  const seen = new Set()
  for (const sentence of sentences) {
    const key = sentence.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(sentence)
  }

  if (deduped.length === 0) {
    return source.slice(0, maxLength)
  }

  let output = ''
  for (const sentence of deduped) {
    const next = output ? `${output} ${sentence}` : sentence
    if (next.length > maxLength && output.length >= minLength) break
    if (next.length > maxLength) {
      output = next.slice(0, maxLength)
      break
    }
    output = next
  }

  if (!output) {
    output = deduped[0].slice(0, maxLength)
  }

  return output.slice(0, maxLength).trim()
}

function buildLocalCompanySummary(company = {}, maxLength = 58, minLength = Math.max(24, Math.floor(maxLength * 0.65))) {
  const source = stripHtml(company.description)
  if (!source) return '企业简介待补充'

  const sentences = source
    .split(/(?<=[。！？!?.；;])/)
    .map((item) => item.trim())
    .filter(Boolean)

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
  if (cleanSummary.length < 120 && cleanDescription.length >= 180) return true
  if (cleanSummary.length > 118) return true
  if (cleanDescription.length >= 560) return true
  if ((cleanDescription.match(/[•·▪●]/g) || []).length >= 6) return true
  return false
}

function shouldUseAiCompanySummary({ localSummary = '', description = '' } = {}) {
  const cleanSummary = normalizeText(localSummary)
  const cleanDescription = stripHtml(description)

  if (!cleanDescription) return false
  if (cleanSummary.length < 36 && cleanDescription.length >= 96) return true
  if (cleanSummary.length > 64) return true
  if (cleanDescription.length >= 220) return true
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
        ${completenessSql} AS completeness_score
     FROM jobs j
     LEFT JOIN trusted_companies tc
       ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
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
    const displayCompanyDescription = preferChinese(companyTranslations?.description, row.company_description)
    const displayAddress = preferChinese(companyTranslations?.address || companyTranslations?.headquarters, row.address)

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
      hiringEmail: normalizeText(row.hiring_email),
      emailType: normalizeText(row.email_type),
      referralContacts: contacts,
      companyInfoCompact,
      referralInfoCompact,
      referralInfoBlock,
      completenessScore: Number(row.completeness_score ?? completeness.completenessScore),
      missingFields: completeness.missingFields,
      hasReferralContact: completeness.hasReferralContact,
      hasCompanyMeta: completeness.hasCompanyMeta
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
    companyDescription: normalizeText(payload.companyDescription),
    updatedAt: normalizeText(payload.updatedAt)
  }

  const localSummary = buildLocalSummary(job, 168)
  const localCompanySummary = buildLocalCompanySummary({ description: job.companyDescription }, 60)
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
    usedFallback: false,
    cacheHit: false
  }

  if (shouldUseAiSummary({ localSummary, description: job.description })) {
    try {
      const prompt = [
        '请将下面岗位信息压缩为适合 3:4 招聘海报展示的中文摘要。',
        '要求：',
        '1. 只输出一段中文，不要加标题、序号、引号。',
        '2. 保留岗位核心职责、关键方向和卖点，不要虚构信息。',
        '3. 控制在 120 到 170 个中文字符内，尽量充分利用海报里的摘要区域。',
        '4. 如果原文信息零散，请帮忙概括成自然表达。',
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
        systemPrompt: '你是一个招聘运营文案压缩助手，只负责将岗位详情压缩成适合社媒海报展示的简洁中文摘要。',
        prompt,
        maxTokens: 260
      })

      result = {
        ...result,
        jobSummary: normalizeText(aiJob.content, localSummary),
        provider: 'bailian',
        usedFallback: !normalizeText(aiJob.content)
      }
    } catch (error) {
      result = {
        ...result,
        provider: 'local',
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
        '2. 保留企业定位、业务方向或最有辨识度的信息。',
        '3. 控制在 36 到 60 个中文字符内，尽量信息完整但不要啰嗦。',
        '',
        `企业名称：${normalizeText(job.company)}`,
        `本地摘要候选：${localCompanySummary}`,
        `企业简介：${stripHtml(job.companyDescription)}`
      ].join('\n')

      const aiCompany = await callBailianTextSummary({
        systemPrompt: '你是一个招聘运营文案压缩助手，只负责将企业简介压缩为适合社媒岗位海报展示的简洁中文介绍。',
        prompt,
        maxTokens: 120
      })

      result = {
        ...result,
        companySummary: normalizeText(aiCompany.content, result.companySummary),
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

export {
  SUMMARY_TEMPLATE_VERSION,
  buildLocalSummary,
  buildLocalCompanySummary,
  shouldUseAiSummary,
  shouldUseAiCompanySummary
}
