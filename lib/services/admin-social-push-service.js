import neonHelper from '../../server-utils/dal/neon-helper.js'
import { createAdminMessageOnce } from './admin-message-service.js'
import { JOB_CATEGORY_OPTIONS, normalizeJobCategoryList } from '../shared/job-categories.js'

const GROUPS_TABLE = 'social_push_groups'
const GROUP_VERSIONS_TABLE = 'social_push_group_versions'
const RUNS_TABLE = 'social_push_runs'
const HISTORY_TABLE = 'social_push_history'
const OVERRIDES_TABLE = 'social_push_overrides'

const DEFAULT_TIMEZONE = process.env.ADMIN_DAILY_DIGEST_TIMEZONE || 'Asia/Shanghai'
const DEFAULT_SITE_URL = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
const EXPECTED_SEND_HOUR = 10
const EXPECTED_SEND_MINUTE = 0
const TARGET_COUNT = 3
const REPEAT_WINDOW_DAYS = 3
const STRICT_COMPANY_LIMIT = 1
const RELAXED_COMPANY_LIMIT = 2
const SOCIAL_PUSH_SCHEMA_ERROR_CODE = 'SOCIAL_PUSH_SCHEMA_MISSING'

const AUDIENCE_CONFIG = {
  public: {
    key: 'public',
    label: '非会员群',
    titleSuffix: '精选推送',
    ruleSummary: '展示岗位基础信息，复制时使用海狗分享链接。'
  },
  member: {
    key: 'member',
    label: '会员群',
    titleSuffix: '会员推荐',
    ruleSummary: '补充企业和内推信息，复制时保留海狗分享链接。'
  }
}

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

function normalizeText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
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

function clampSortOrder(value) {
  const numeric = Number.parseInt(value, 10)
  if (Number.isNaN(numeric)) return 100
  return Math.max(1, Math.min(999, numeric))
}

function clampTargetCount(value) {
  const numeric = Number.parseInt(value, 10)
  if (Number.isNaN(numeric)) return TARGET_COUNT
  return Math.max(1, Math.min(TARGET_COUNT, numeric))
}

function createSchemaError(message = 'Social push tables are missing') {
  const error = new Error(message)
  error.code = SOCIAL_PUSH_SCHEMA_ERROR_CODE
  return error
}

function isSchemaError(error) {
  return error?.code === SOCIAL_PUSH_SCHEMA_ERROR_CODE
}

async function ensureTablesReady() {
  const [rows, versionColumns] = await Promise.all([
    neonHelper.query(
    `SELECT
      to_regclass('public.social_push_groups') AS groups_table,
      to_regclass('public.social_push_group_versions') AS group_versions_table,
      to_regclass('public.social_push_runs') AS runs_table,
      to_regclass('public.social_push_history') AS history_table,
      to_regclass('public.social_push_overrides') AS overrides_table`
    ),
    neonHelper.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'social_push_group_versions'
         AND column_name = ANY($1)`,
      [['internal_name', 'sort_order', 'is_active']]
    )
  ])

  const row = rows?.[0] || {}
  if (!row.groups_table || !row.group_versions_table || !row.runs_table || !row.history_table || !row.overrides_table) {
    throw createSchemaError('社群推送依赖的数据表不存在，请先执行迁移 024_social_push_groups.sql')
  }

  const requiredColumns = new Set(['internal_name', 'sort_order', 'is_active'])
  for (const item of versionColumns || []) {
    requiredColumns.delete(String(item.column_name || ''))
  }
  if (requiredColumns.size > 0) {
    throw createSchemaError('社群推送数据表版本过旧，请重新执行迁移 024_social_push_groups.sql')
  }
}

async function ensureDefaultGroupSeed() {
  const existing = await neonHelper.query(
    `SELECT id
     FROM ${GROUPS_TABLE}
     WHERE internal_name = '默认分组'
     ORDER BY id ASC
     LIMIT 1`
  )

  let groupId = existing?.[0]?.id
  if (!groupId) {
    const inserted = await neonHelper.query(
      `INSERT INTO ${GROUPS_TABLE} (internal_name, sort_order, is_active)
       VALUES ('默认分组', 1, true)
       RETURNING id`
    )
    groupId = inserted?.[0]?.id
  }

  if (!groupId) return

  const versionRows = await neonHelper.query(
    `SELECT COUNT(*) AS count
     FROM ${GROUP_VERSIONS_TABLE}
     WHERE group_id = $1`,
    [groupId]
  )
  const versionCount = Number.parseInt(versionRows?.[0]?.count || '0', 10)
  if (versionCount > 0) return

  await neonHelper.query(
    `INSERT INTO ${GROUP_VERSIONS_TABLE} (group_id, internal_name, sort_order, is_active, selected_roles, effective_date)
     VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_DATE)`,
    [groupId, '默认分组', 1, true, JSON.stringify(JOB_CATEGORY_OPTIONS)]
  )
}

function getDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const map = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )

  return {
    year: map.year,
    month: map.month,
    day: map.day
  }
}

function getTimeParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const map = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )

  return {
    hour: Number.parseInt(map.hour || '0', 10),
    minute: Number.parseInt(map.minute || '0', 10)
  }
}

function getBatchDate(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getDateParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function getBatchLabelFromBatchDate(batchDate, fallbackDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const normalized = normalizeText(batchDate)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-')
    return `${year}年${month}月${day}日`
  }
  const parts = getDateParts(fallbackDate, timeZone)
  return `${parts.year}年${parts.month}月${parts.day}日`
}

function shiftBatchDate(batchDate, offsetDays = 0) {
  const normalized = normalizeText(batchDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const [year, month, day] = normalized.split('-').map((value) => Number.parseInt(value, 10))
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + offsetDays)

  return [
    String(base.getUTCFullYear()).padStart(4, '0'),
    String(base.getUTCMonth() + 1).padStart(2, '0'),
    String(base.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function getScheduleContext(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const currentBatchDate = getBatchDate(now, timeZone)
  const timeParts = getTimeParts(now, timeZone)
  const hasReachedRefreshTime = timeParts.hour > EXPECTED_SEND_HOUR
    || (timeParts.hour === EXPECTED_SEND_HOUR && timeParts.minute >= EXPECTED_SEND_MINUTE)
  const displayBatchDate = hasReachedRefreshTime
    ? currentBatchDate
    : shiftBatchDate(currentBatchDate, -1)

  return {
    timeZone,
    refreshHour: EXPECTED_SEND_HOUR,
    refreshMinute: EXPECTED_SEND_MINUTE,
    currentBatchDate,
    currentBatchLabel: getBatchLabelFromBatchDate(currentBatchDate, now, timeZone),
    displayBatchDate,
    displayBatchLabel: getBatchLabelFromBatchDate(displayBatchDate, now, timeZone),
    hasReachedRefreshTime
  }
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

function normalizeLocation(value) {
  const location = normalizeText(value, '全球远程')
  const lower = location.toLowerCase()
  if (lower === 'remote') return '全球远程'
  if (lower === 'global remote') return '全球远程'
  if (lower === 'remote - china') return '中国远程'
  return location
}

function normalizeEmailTypeLabel(value, fallback = '通用邮箱') {
  return EMAIL_TYPE_LABELS[String(value || '').trim()] || normalizeText(value, fallback)
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
    id: '',
    name: '',
    title: '',
    hiringEmail: fallbackEmail,
    emailType: normalizeEmailTypeLabel(fallbackEmailType)
  }]
}

function formatCompactField(parts = []) {
  return parts.map((part) => normalizeText(part, '待补充')).join('｜')
}

function formatReferralLine(contact = {}) {
  return `${normalizeText(contact?.name, '待补充')}｜${normalizeText(contact?.title, '待补充')}：${normalizeText(contact?.hiringEmail, '待补充')}`
}

function normalizeJobTypeLabel(value) {
  const normalized = normalizeText(value, '未标注')
  const lower = normalized.toLowerCase().replace(/\s+/g, '-')

  if (['full-time', 'full_time', 'fulltime'].includes(lower)) return '全职'
  if (['part-time', 'part_time', 'parttime'].includes(lower)) return '兼职'
  if (lower === 'contract') return '合同制'
  if (lower === 'freelance') return '自由职业'
  if (['intern', 'internship'].includes(lower)) return '实习'
  if (lower === 'project') return '项目制'

  return normalized
}

function normalizeExperienceLevelLabel(value) {
  const normalized = normalizeText(value, '未标注')
  const lower = normalized.toLowerCase()

  if (['intern', 'internship'].includes(lower)) return '实习'
  if (['entry', 'junior'].includes(lower)) return '初级'
  if (['mid', 'middle'].includes(lower)) return '中级'
  if (lower === 'senior') return '高级'
  if (lower === 'lead') return '负责人'
  if (lower === 'manager') return '经理'
  if (lower === 'director') return '总监'
  if (lower === 'executive') return '高管'

  return normalized
}

function buildMetaLine(job) {
  return [
    normalizeLocation(job.location),
    normalizeText(job.category, '未分类'),
    normalizeJobTypeLabel(job.jobType),
    normalizeExperienceLevelLabel(job.experienceLevel)
  ].join('｜')
}

function normalizeCompanyKey(value) {
  return normalizeText(value).toLowerCase()
}

function computeFreshnessScore(publishedAt, batchDate) {
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(String(batchDate || ''))
    ? new Date(`${batchDate}T00:00:00Z`)
    : new Date()
  const published = publishedAt ? new Date(publishedAt) : null
  if (!published || Number.isNaN(published.getTime())) return 20

  const diffMs = Math.max(reference.getTime() - published.getTime(), 0)
  const diffDays = diffMs / (24 * 60 * 60 * 1000)

  if (diffDays <= 7) return 100
  if (diffDays <= 30) return 60
  return 20
}

function parseCompanyRating(value) {
  const numeric = Number.parseFloat(String(value || '').replace(/[^\d.]+/g, ''))
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.min(5, numeric))
}

function computeRecommendationScore(job, batchDate) {
  const completeness = Math.max(0, Math.min(100, Number(job.completenessScore || 0)))
  const rating = (parseCompanyRating(job.companyRating) / 5) * 100
  const freshness = computeFreshnessScore(job.publishedAt || job.updatedAt || job.createdAt, batchDate)

  return Number((completeness * 0.55 + rating * 0.25 + freshness * 0.20).toFixed(2))
}

function mapCandidateRow(row) {
  const allContacts = normalizeReferralContacts(row.referral_contacts, row.hiring_email, row.email_type)
  const selectedIds = new Set(
    (Array.isArray(row.selected_referral_contact_ids) ? row.selected_referral_contact_ids : [])
      .map((value) => normalizeText(value))
      .filter(Boolean)
  )
  const isCustomReferralMode = normalizeText(row.referral_contact_mode, 'inherit_all').toLowerCase() === 'custom'
  const contacts = isCustomReferralMode
    ? allContacts.filter((contact) => selectedIds.has(normalizeText(contact.id)))
    : allContacts

  return {
    id: String(row.job_id),
    title: normalizeText(row.title, '未命名岗位'),
    company: normalizeText(row.company, '未知企业'),
    location: normalizeText(row.location),
    category: normalizeText(row.category, '未分类'),
    jobType: normalizeText(row.job_type),
    experienceLevel: normalizeText(row.experience_level),
    applicationUrl: normalizeText(row.url),
    shareUrl: buildShareUrl(row.job_id),
    employeeCount: normalizeText(row.employee_count),
    address: normalizeText(row.address),
    foundedYear: normalizeText(row.founded_year ? `${row.founded_year}年` : ''),
    companyRating: normalizeText(row.company_rating),
    industry: normalizeText(row.industry || row.trusted_industry),
    contacts,
    completenessScore: Number(row.completeness_score || 0),
    memberOnly: row.member_only === true,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  }
}

function buildCompanyInfoLine(job) {
  return formatCompactField([
    normalizeText(job.employeeCount),
    normalizeText(job.address),
    normalizeText(job.foundedYear),
    normalizeText(job.companyRating)
  ])
}

function buildReferralInfoLines(job) {
  if (!Array.isArray(job.contacts) || job.contacts.length === 0) {
    return []
  }
  return job.contacts
    .filter((contact) => contact?.hiringEmail)
    .map((contact) => `${normalizeEmailTypeLabel(contact.emailType)}：${formatReferralLine(contact)}`)
}

function buildCopyTitle(batchLabel, audienceKey) {
  const config = AUDIENCE_CONFIG[audienceKey]
  return `海狗远程俱乐部 ${batchLabel} ${config.titleSuffix}`
}

function buildCopyText({ batchLabel, audienceKey, jobs }) {
  const title = buildCopyTitle(batchLabel, audienceKey)
  if (!jobs.length) {
    return `${title}\n\n今日暂无符合条件的岗位。`
  }

  const blocks = jobs.map((job) => {
    const lines = [
      `【${job.title}】`,
      `【${job.company}】`,
      normalizeText(job.metaLine, buildMetaLine(job)),
      `海狗链接：${job.shareUrl}`
    ]

    if (audienceKey === 'member') {
      lines.push(`企业信息：${job.companyInfoLine || '待补充'}`)
      if (job.referralInfoLines.length > 0) {
        lines.push(...job.referralInfoLines.map((line) => `内推信息：${line}`))
      }
    }

    return lines.join('\n')
  })

  return `${title}\n\n${blocks.join('\n\n')}`
}

function buildPreviewJob(job, audienceKey) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    category: job.category,
    jobType: job.jobType,
    experienceLevel: job.experienceLevel,
    metaLine: buildMetaLine(job),
    shareUrl: job.shareUrl,
    applicationUrl: job.applicationUrl,
    companyInfoLine: buildCompanyInfoLine(job),
    referralInfoLines: buildReferralInfoLines(job),
    recommendationScore: job.recommendationScore,
    audienceKey
  }
}

async function fetchCandidateJobs({ audienceKey, roles, excludeIds = [], limit = 120 }) {
  if (!Array.isArray(roles) || roles.length === 0) return []

  const rows = await neonHelper.query(
    `SELECT
      j.job_id,
      j.title,
      j.company,
      j.location,
      j.url,
      j.category,
      j.job_type,
      j.experience_level,
      j.industry,
      j.member_only,
      j.published_at,
      j.updated_at,
      j.created_at,
      j.referral_contact_mode,
      tc.employee_count,
      tc.address,
      tc.founded_year,
      tc.company_rating,
      tc.industry AS trusted_industry,
      tc.referral_contacts,
      tc.hiring_email,
      tc.email_type,
      COALESCE(jrcl.selected_referral_contact_ids, ARRAY[]::text[]) AS selected_referral_contact_ids,
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
      ) AS completeness_score
    FROM jobs j
    LEFT JOIN trusted_companies tc
      ON (j.company_id = tc.company_id OR (j.company_id IS NULL AND LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name))))
    LEFT JOIN (
      SELECT job_id, array_agg(contact_id ORDER BY contact_id) AS selected_referral_contact_ids
      FROM job_referral_contact_links
      GROUP BY job_id
    ) jrcl
      ON jrcl.job_id = CAST(j.job_id AS VARCHAR)
    WHERE j.status = 'active'
      AND COALESCE(j.is_approved, false) = true
      AND COALESCE(NULLIF(BTRIM(j.title), ''), NULL) IS NOT NULL
      AND COALESCE(NULLIF(BTRIM(j.company), ''), NULL) IS NOT NULL
      AND BTRIM(COALESCE(j.category, '')) = ANY($1)
      AND NOT (j.job_id = ANY($2))
      AND ($3 = 'member' OR COALESCE(j.member_only, false) = false)
    ORDER BY COALESCE(j.published_at, j.updated_at, j.created_at) DESC NULLS LAST,
      j.updated_at DESC NULLS LAST,
      j.created_at DESC NULLS LAST,
      j.job_id DESC
    LIMIT $4`,
    [roles, excludeIds, audienceKey, limit]
  )

  return (rows || []).map(mapCandidateRow)
}

function countCompanies(jobs = []) {
  const map = new Map()
  for (const job of jobs) {
    const key = normalizeCompanyKey(job.company)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

function selectWithCompanyLimit(sortedJobs, existingJobs = [], targetCount = TARGET_COUNT) {
  const accepted = []
  const acceptedIds = new Set(existingJobs.map((job) => String(job.id)))
  const strictCounts = countCompanies(existingJobs)

  for (const job of sortedJobs) {
    if (accepted.length >= targetCount) break
    if (acceptedIds.has(String(job.id))) continue

    const companyKey = normalizeCompanyKey(job.company)
    const count = strictCounts.get(companyKey) || 0
    if (companyKey && count >= STRICT_COMPANY_LIMIT) continue

    accepted.push(job)
    acceptedIds.add(String(job.id))
    if (companyKey) strictCounts.set(companyKey, count + 1)
  }

  if (accepted.length >= targetCount) {
    return accepted.slice(0, targetCount)
  }

  const relaxedCounts = countCompanies(existingJobs.concat(accepted))
  for (const job of sortedJobs) {
    if (accepted.length >= targetCount) break
    if (acceptedIds.has(String(job.id))) continue

    const companyKey = normalizeCompanyKey(job.company)
    const count = relaxedCounts.get(companyKey) || 0
    if (companyKey && count >= RELAXED_COMPANY_LIMIT) continue

    accepted.push(job)
    acceptedIds.add(String(job.id))
    if (companyKey) relaxedCounts.set(companyKey, count + 1)
  }

  return accepted.slice(0, targetCount)
}

async function fetchRecentHistoryIds(groupId, audienceKey, batchDate) {
  const rows = await neonHelper.query(
    `SELECT job_id
     FROM ${HISTORY_TABLE}
     WHERE group_id = $1
       AND audience_key = $2
       AND batch_date >= ($3::date - INTERVAL '2 day')`,
    [groupId, audienceKey, batchDate]
  )

  return Array.from(new Set((rows || []).map((row) => String(row.job_id)).filter(Boolean)))
}

async function fetchOverrideExcludedIds(groupId, audienceKey, batchDate) {
  const rows = await neonHelper.query(
    `SELECT job_id
     FROM ${OVERRIDES_TABLE}
     WHERE group_id = $1
       AND audience_key = $2
       AND batch_date = $3
       AND action = 'removed'`,
    [groupId, audienceKey, batchDate]
  )

  return Array.from(new Set((rows || []).map((row) => String(row.job_id)).filter(Boolean)))
}

async function fetchRun(batchDate, groupId, audienceKey) {
  const rows = await neonHelper.query(
    `SELECT *
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1 AND group_id = $2 AND audience_key = $3
     LIMIT 1`,
    [batchDate, groupId, audienceKey]
  )

  return rows?.[0] || null
}

function parseRunPayload(run) {
  return safeParseJson(run?.payload, null)
}

async function claimRun({ batchDate, groupId, audienceKey, timeZone }) {
  const rows = await neonHelper.query(
    `INSERT INTO ${RUNS_TABLE} (
      batch_date,
      group_id,
      audience_key,
      timezone,
      status,
      target_count,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, 'processing', $5, NOW(), NOW())
    ON CONFLICT (batch_date, group_id, audience_key) DO NOTHING
    RETURNING *`,
    [batchDate, groupId, audienceKey, timeZone, TARGET_COUNT]
  )

  if (rows?.[0]) {
    return { acquired: true, run: rows[0] }
  }

  const existing = await fetchRun(batchDate, groupId, audienceKey)
  if (!existing) return { acquired: false, run: null }

  if (existing.status === 'ready' && parseRunPayload(existing)?.card) {
    return { acquired: false, run: existing }
  }

  const updated = await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'processing',
         error = NULL,
         payload = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existing.id]
  )

  return { acquired: true, run: updated?.[0] || existing }
}

async function markRunReady(runId, payload) {
  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'ready',
         job_count = $2,
         subject = $3,
         payload = $4::jsonb,
         generated_at = NOW(),
         error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [runId, Number(payload?.card?.jobCount || 0), normalizeText(payload?.subject), JSON.stringify(payload)]
  )
}

async function markRunFailed(runId, error, payload = {}) {
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

async function writeHistory(runId, batchDate, groupId, audienceKey, jobs = []) {
  for (const job of jobs) {
    await neonHelper.query(
      `INSERT INTO ${HISTORY_TABLE} (run_id, batch_date, group_id, audience_key, job_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (batch_date, group_id, audience_key, job_id) DO NOTHING`,
      [runId, batchDate, groupId, audienceKey, String(job.id)]
    )
  }
}

async function removeHistory(batchDate, groupId, audienceKey, jobId) {
  await neonHelper.query(
    `DELETE FROM ${HISTORY_TABLE}
     WHERE batch_date = $1 AND group_id = $2 AND audience_key = $3 AND job_id = $4`,
    [batchDate, groupId, audienceKey, String(jobId)]
  )
}

async function clearRunHistory(batchDate, groupId, audienceKey) {
  await neonHelper.query(
    `DELETE FROM ${HISTORY_TABLE}
     WHERE batch_date = $1 AND group_id = $2 AND audience_key = $3`,
    [batchDate, groupId, audienceKey]
  )
}

async function upsertRemovedOverride(batchDate, groupId, audienceKey, jobId, replacementJobId = null) {
  await neonHelper.query(
    `INSERT INTO ${OVERRIDES_TABLE} (batch_date, group_id, audience_key, job_id, action, replacement_job_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'removed', $5, NOW(), NOW())
     ON CONFLICT (batch_date, group_id, audience_key, job_id, action)
     DO UPDATE SET replacement_job_id = EXCLUDED.replacement_job_id, updated_at = NOW()`,
    [batchDate, groupId, audienceKey, String(jobId), replacementJobId ? String(replacementJobId) : null]
  )
}

function buildCardPayload({ batchDate, batchLabel, group, audienceKey, jobs, generatedAt }) {
  const config = AUDIENCE_CONFIG[audienceKey]
  const normalizedJobs = jobs.map((job) => {
    const companyInfoLine = buildCompanyInfoLine(job)
    const referralInfoLines = buildReferralInfoLines(job)
    return {
      ...buildPreviewJob(job, audienceKey),
      companyInfoLine,
      referralInfoLines
    }
  })

  return {
    key: audienceKey,
    audienceLabel: config.label,
    title: `${group.internalName} · ${config.label}`,
    titleSuffix: config.titleSuffix,
    ruleSummary: config.ruleSummary,
    repeatWindowDays: REPEAT_WINDOW_DAYS,
    jobCount: normalizedJobs.length,
    copyText: buildCopyText({ batchLabel, audienceKey, jobs: normalizedJobs }),
    jobs: normalizedJobs,
    generatedAt: generatedAt || new Date().toISOString(),
    batchDate,
    groupMeta: {
      id: group.id,
      internalName: group.internalName,
      selectedRoles: group.selectedRoles
    }
  }
}

async function getEffectiveGroups(batchDate) {
  const rows = await neonHelper.query(
    `SELECT
      g.id,
      v.internal_name,
      v.sort_order,
      v.is_active,
      v.selected_roles,
      v.effective_date
    FROM ${GROUPS_TABLE} g
    JOIN LATERAL (
      SELECT internal_name, sort_order, is_active, selected_roles, effective_date
      FROM ${GROUP_VERSIONS_TABLE}
      WHERE group_id = g.id
        AND effective_date <= $1::date
      ORDER BY effective_date DESC, id DESC
      LIMIT 1
    ) v ON TRUE
    WHERE v.is_active = true
    ORDER BY v.sort_order ASC, g.id ASC`,
    [batchDate]
  )

  return (rows || []).map((row) => ({
    id: Number(row.id),
    internalName: normalizeText(row.internal_name, `分组 ${row.id}`),
    sortOrder: Number(row.sort_order || 100),
    isActive: row.is_active === true,
    selectedRoles: normalizeJobCategoryList(safeParseJson(row.selected_roles, [])),
    effectiveDate: normalizeText(row.effective_date)
  })).filter((group) => group.selectedRoles.length > 0)
}

async function getGroupsForSettings(referenceDate = getBatchDate(new Date(), DEFAULT_TIMEZONE)) {
  const tomorrow = shiftBatchDate(referenceDate, 1)
  const rows = await neonHelper.query(
    `SELECT
      g.id,
      current_version.internal_name AS current_internal_name,
      current_version.sort_order AS current_sort_order,
      current_version.is_active AS current_is_active,
      current_version.selected_roles AS current_roles,
      current_version.effective_date AS current_effective_date,
      pending_version.internal_name AS pending_internal_name,
      pending_version.sort_order AS pending_sort_order,
      pending_version.is_active AS pending_is_active,
      pending_version.selected_roles AS pending_roles,
      pending_version.effective_date AS pending_effective_date
    FROM ${GROUPS_TABLE} g
    LEFT JOIN LATERAL (
      SELECT internal_name, sort_order, is_active, selected_roles, effective_date
      FROM ${GROUP_VERSIONS_TABLE}
      WHERE group_id = g.id
        AND effective_date <= $1::date
      ORDER BY effective_date DESC, id DESC
      LIMIT 1
    ) current_version ON TRUE
    LEFT JOIN LATERAL (
      SELECT internal_name, sort_order, is_active, selected_roles, effective_date
      FROM ${GROUP_VERSIONS_TABLE}
      WHERE group_id = g.id
        AND effective_date >= $2::date
      ORDER BY effective_date ASC, id DESC
      LIMIT 1
    ) pending_version ON TRUE
    ORDER BY COALESCE(pending_version.sort_order, current_version.sort_order, g.sort_order, 100) ASC, g.id ASC`,
    [referenceDate, tomorrow]
  )

  return (rows || []).map((row) => ({
    id: Number(row.id),
    internalName: normalizeText(row.current_internal_name || row.pending_internal_name),
    sortOrder: Number(row.current_sort_order || row.pending_sort_order || 100),
    isActive: row.current_is_active === true,
    currentRoles: normalizeJobCategoryList(safeParseJson(row.current_roles, [])),
    currentInternalName: normalizeText(row.current_internal_name),
    currentSortOrder: Number(row.current_sort_order || 100),
    currentIsActive: row.current_is_active === true,
    currentEffectiveDate: normalizeText(row.current_effective_date),
    pendingRoles: normalizeJobCategoryList(safeParseJson(row.pending_roles, [])),
    pendingInternalName: normalizeText(row.pending_internal_name),
    pendingSortOrder: Number(row.pending_sort_order || row.current_sort_order || 100),
    pendingIsActive: row.pending_is_active == null ? row.current_is_active === true : row.pending_is_active === true,
    pendingEffectiveDate: normalizeText(row.pending_effective_date)
  }))
}

async function buildAudienceSelection({ batchDate, batchLabel, group, audienceKey }) {
  const recentHistoryIds = await fetchRecentHistoryIds(group.id, audienceKey, batchDate)
  const overrideExcludedIds = await fetchOverrideExcludedIds(group.id, audienceKey, batchDate)
  const excludeIds = Array.from(new Set([...recentHistoryIds, ...overrideExcludedIds]))

  const candidates = await fetchCandidateJobs({
    audienceKey,
    roles: group.selectedRoles,
    excludeIds,
    limit: 120
  })

  const scored = candidates
    .map((job) => ({
      ...job,
      recommendationScore: computeRecommendationScore(job, batchDate)
    }))
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore
      }
      const publishedA = new Date(a.publishedAt || a.updatedAt || a.createdAt || 0).getTime()
      const publishedB = new Date(b.publishedAt || b.updatedAt || b.createdAt || 0).getTime()
      return publishedB - publishedA
    })

  const selectedJobs = selectWithCompanyLimit(scored, [], TARGET_COUNT)

  return buildCardPayload({
    batchDate,
    batchLabel,
    group,
    audienceKey,
    jobs: selectedJobs
  })
}

async function ensureAudienceCard({ batchDate, batchLabel, group, audienceKey, timeZone, forceRefresh = false }) {
  const existingRun = await fetchRun(batchDate, group.id, audienceKey)
  const existingPayload = parseRunPayload(existingRun)
  if (!forceRefresh && existingRun?.status === 'ready' && existingPayload?.card) {
    return {
      groupId: group.id,
      groupInternalName: group.internalName,
      groupSortOrder: group.sortOrder,
      ...existingPayload.card
    }
  }

  if (forceRefresh && existingRun?.id) {
    await clearRunHistory(batchDate, group.id, audienceKey)
    await neonHelper.query(
      `UPDATE ${RUNS_TABLE}
       SET status = 'processing',
           job_count = 0,
           subject = NULL,
           payload = NULL,
           error = NULL,
           generated_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [existingRun.id]
    )
  }

  const claimed = await claimRun({ batchDate, groupId: group.id, audienceKey, timeZone })
  const run = claimed.run
  if (!claimed.acquired) {
    const payload = parseRunPayload(run)
    if (payload?.card) {
      return {
        groupId: group.id,
        groupInternalName: group.internalName,
        groupSortOrder: group.sortOrder,
        ...payload.card
      }
    }
  }

  const card = await buildAudienceSelection({ batchDate, batchLabel, group, audienceKey })

  try {
    if (run?.id) {
      await writeHistory(run.id, batchDate, group.id, audienceKey, card.jobs)
      await markRunReady(run.id, {
        subject: buildCopyTitle(batchLabel, audienceKey),
        card
      })
    }
  } catch (error) {
    if (run?.id) {
      await markRunFailed(run.id, error, {
        batchDate,
        groupId: group.id,
        audienceKey
      })
    }
    throw error
  }

  return {
    groupId: group.id,
    groupInternalName: group.internalName,
    groupSortOrder: group.sortOrder,
    ...card
  }
}

async function buildPreviewGroups({ batchDate, batchLabel, timeZone, forceRefresh = false }) {
  const groups = await getEffectiveGroups(batchDate)
  const builtGroups = []

  for (const group of groups) {
    const publicCard = await ensureAudienceCard({ batchDate, batchLabel, group, audienceKey: 'public', timeZone, forceRefresh })
    const memberCard = await ensureAudienceCard({ batchDate, batchLabel, group, audienceKey: 'member', timeZone, forceRefresh })

    builtGroups.push({
      id: group.id,
      internalName: group.internalName,
      sortOrder: group.sortOrder,
      selectedRoles: group.selectedRoles,
      publicCard,
      memberCard,
      generatedAt: publicCard.generatedAt || memberCard.generatedAt || null
    })
  }

  return builtGroups
}

async function ensurePreview(options = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureTablesReady()
  await ensureDefaultGroupSeed()

  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const now = options.now instanceof Date ? options.now : new Date()
  const baseSchedule = getScheduleContext(now, timeZone)
  const batchDate = normalizeText(
    options.batchDate,
    options.forceCurrentBatch === true ? baseSchedule.currentBatchDate : baseSchedule.displayBatchDate
  )
  const batchLabel = getBatchLabelFromBatchDate(batchDate, now, timeZone)

  const groups = await buildPreviewGroups({
    batchDate,
    batchLabel,
    timeZone,
    forceRefresh: options.forceRefresh === true
  })

  return {
    success: true,
    source: 'cache',
    timeZone,
    batchDate,
    batchLabel,
    schedule: {
      ...baseSchedule,
      displayBatchDate: batchDate,
      displayBatchLabel: batchLabel
    },
    generatedAt: groups.reduce((latest, group) => {
      const current = new Date(group.generatedAt || 0).getTime()
      return current > latest ? current : latest
    }, 0) || null,
    groups
  }
}

async function replaceRunJob({ groupId, audienceKey, jobId, batchDate, timeZone = DEFAULT_TIMEZONE }) {
  const normalizedAudience = audienceKey === 'member' ? 'member' : 'public'
  const normalizedBatchDate = normalizeText(batchDate, getScheduleContext(new Date(), timeZone).displayBatchDate)

  await ensureTablesReady()
  await ensureDefaultGroupSeed()

  const run = await fetchRun(normalizedBatchDate, groupId, normalizedAudience)
  const payload = parseRunPayload(run)
  if (!run || run.status !== 'ready' || !payload?.card) {
    throw new Error('当前批次尚未生成，请先刷新当天结果')
  }

  const card = payload.card
  const existingJobs = Array.isArray(card.jobs) ? card.jobs : []
  const removedJob = existingJobs.find((job) => String(job.id) === String(jobId))
  if (!removedJob) {
    throw new Error('待移除岗位不存在')
  }

  const remainingJobs = existingJobs.filter((job) => String(job.id) !== String(jobId))

  await removeHistory(normalizedBatchDate, groupId, normalizedAudience, jobId)
  await upsertRemovedOverride(normalizedBatchDate, groupId, normalizedAudience, jobId)

  const selectedRoles = normalizeJobCategoryList(card.groupMeta?.selectedRoles || [])
  const historyIds = await fetchRecentHistoryIds(groupId, normalizedAudience, normalizedBatchDate)
  const overrideIds = await fetchOverrideExcludedIds(groupId, normalizedAudience, normalizedBatchDate)
  const excludeIds = Array.from(new Set([
    ...historyIds,
    ...overrideIds,
    ...remainingJobs.map((job) => String(job.id))
  ]))

  let replacementJob = null
  if (selectedRoles.length > 0 && remainingJobs.length < TARGET_COUNT) {
    const candidates = await fetchCandidateJobs({
      audienceKey: normalizedAudience,
      roles: selectedRoles,
      excludeIds,
      limit: 120
    })

    const scored = candidates
      .map((job) => ({
        ...job,
        recommendationScore: computeRecommendationScore(job, normalizedBatchDate)
      }))
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore
        }
        const publishedA = new Date(a.publishedAt || a.updatedAt || a.createdAt || 0).getTime()
        const publishedB = new Date(b.publishedAt || b.updatedAt || b.createdAt || 0).getTime()
        return publishedB - publishedA
      })

    replacementJob = selectWithCompanyLimit(scored, remainingJobs, 1)[0] || null
  }

  if (replacementJob) {
    await upsertRemovedOverride(normalizedBatchDate, groupId, normalizedAudience, jobId, replacementJob.id)
    await writeHistory(run.id, normalizedBatchDate, groupId, normalizedAudience, [replacementJob])
  }

  const nextJobs = replacementJob
    ? remainingJobs.concat(buildPreviewJob({
      ...replacementJob,
      recommendationScore: replacementJob.recommendationScore,
      companyInfoLine: buildCompanyInfoLine(replacementJob),
      referralInfoLines: buildReferralInfoLines(replacementJob)
    }, normalizedAudience))
    : remainingJobs

  const normalizedJobs = nextJobs.map((job) => ({
    ...job,
    companyInfoLine: normalizeText(job.companyInfoLine),
    referralInfoLines: Array.isArray(job.referralInfoLines) ? job.referralInfoLines : []
  }))

  const nextCard = {
    ...card,
    jobCount: normalizedJobs.length,
    jobs: normalizedJobs,
    generatedAt: new Date().toISOString(),
    copyText: buildCopyText({
      batchLabel: getBatchLabelFromBatchDate(normalizedBatchDate, new Date(), timeZone),
      audienceKey: normalizedAudience,
      jobs: normalizedJobs
    })
  }

  await markRunReady(run.id, {
    subject: payload.subject || buildCopyTitle(getBatchLabelFromBatchDate(normalizedBatchDate, new Date(), timeZone), normalizedAudience),
    card: nextCard
  })

  return {
    success: true,
    card: {
      groupId,
      groupInternalName: card.groupMeta?.internalName || '',
      ...nextCard
    },
    replaced: Boolean(replacementJob)
  }
}

export function getAdminDailyJobEmailConfig() {
  const schedule = getScheduleContext(new Date(), DEFAULT_TIMEZONE)
  return {
    timeZone: DEFAULT_TIMEZONE,
    targetCount: TARGET_COUNT,
    databaseConfigured: Boolean(neonHelper.isConfigured),
    refreshHour: EXPECTED_SEND_HOUR,
    refreshMinute: EXPECTED_SEND_MINUTE,
    currentBatchDate: schedule.currentBatchDate,
    displayBatchDate: schedule.displayBatchDate
  }
}

export async function monitorAdminDailyJobEmail(options = {}) {
  if (!neonHelper.isConfigured) {
    return {
      success: true,
      health: 'unknown',
      message: 'Database not configured',
      databaseConfigured: false
    }
  }

  try {
    await ensureTablesReady()
  } catch (error) {
    if (isSchemaError(error)) {
      return {
        success: true,
        health: 'unknown',
        message: error.message,
        migrationRequired: true
      }
    }
    throw error
  }

  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const schedule = getScheduleContext(new Date(), timeZone)
  const batchDate = normalizeText(options.batchDate, schedule.displayBatchDate)
  const runs = await neonHelper.query(
    `SELECT COUNT(*) AS count
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1`,
    [batchDate]
  )

  return {
    success: true,
    health: 'ok',
    message: `${batchDate} 批次社群推送可用`,
    batchDate,
    schedule,
    runCount: Number.parseInt(runs?.[0]?.count || '0', 10)
  }
}

export async function previewAdminDailyJobEmail(options = {}) {
  try {
    return await ensurePreview({
      ...options,
      forceCurrentBatch: false
    })
  } catch (error) {
    if (isSchemaError(error)) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        migrationRequired: true
      }
    }
    throw error
  }
}

export async function refreshAdminDailyJobEmail(options = {}) {
  try {
    return await ensurePreview({
      ...options,
      forceCurrentBatch: true,
      forceRefresh: true
    })
  } catch (error) {
    if (isSchemaError(error)) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        migrationRequired: true
      }
    }
    throw error
  }
}

export async function sendAdminDailyJobEmail(options = {}) {
  return refreshAdminDailyJobEmail(options)
}

export async function listSocialPushGroups(options = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureTablesReady()
  await ensureDefaultGroupSeed()

  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const now = options.now instanceof Date ? options.now : new Date()
  const today = getBatchDate(now, timeZone)
  const tomorrow = shiftBatchDate(today, 1)
  const groups = await getGroupsForSettings(today)

  return {
    success: true,
    roleOptions: JOB_CATEGORY_OPTIONS,
    today,
    tomorrow,
    groups
  }
}

export async function saveSocialPushGroup(input = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureTablesReady()
  await ensureDefaultGroupSeed()

  const internalName = normalizeText(input.internalName)
  const selectedRoles = normalizeJobCategoryList(input.selectedRoles)
  const sortOrder = clampSortOrder(input.sortOrder)
  const isActive = input.isActive !== false
  const effectiveDate = normalizeText(input.effectiveDate, shiftBatchDate(getBatchDate(new Date(), DEFAULT_TIMEZONE), 1))

  if (!internalName) {
    throw new Error('组别名称不能为空')
  }
  if (selectedRoles.length === 0) {
    throw new Error('请至少选择一个岗位角色')
  }

  let groupId = Number.parseInt(input.id, 10)
  if (Number.isNaN(groupId)) {
    const rows = await neonHelper.query(
      `INSERT INTO ${GROUPS_TABLE} (internal_name, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [internalName, sortOrder, isActive]
    )
    groupId = Number(rows?.[0]?.id)
  } else {
    await neonHelper.query(
      `UPDATE ${GROUPS_TABLE}
       SET internal_name = $2,
           sort_order = $3,
           is_active = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [groupId, internalName, sortOrder, isActive]
    )
  }

  await neonHelper.query(
    `INSERT INTO ${GROUP_VERSIONS_TABLE} (group_id, internal_name, sort_order, is_active, selected_roles, effective_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::date, NOW(), NOW())
     ON CONFLICT (group_id, effective_date)
     DO UPDATE SET
       internal_name = EXCLUDED.internal_name,
       sort_order = EXCLUDED.sort_order,
       is_active = EXCLUDED.is_active,
       selected_roles = EXCLUDED.selected_roles,
       updated_at = NOW()`,
    [groupId, internalName, sortOrder, isActive, JSON.stringify(selectedRoles), effectiveDate]
  )

  return listSocialPushGroups()
}

export async function replaceSocialPushJob(input = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureTablesReady()
  await ensureDefaultGroupSeed()

  const groupId = Number.parseInt(input.groupId, 10)
  if (Number.isNaN(groupId)) {
    throw new Error('groupId 无效')
  }

  const audienceKey = input.audienceKey === 'member' ? 'member' : 'public'
  const jobId = normalizeText(input.jobId)
  if (!jobId) {
    throw new Error('jobId 不能为空')
  }

  return replaceRunJob({
    groupId,
    audienceKey,
    jobId,
    batchDate: input.batchDate,
    timeZone: normalizeText(input.timeZone, DEFAULT_TIMEZONE)
  })
}

export async function disableSocialPushGroup(input = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureTablesReady()
  const groupId = Number.parseInt(input.id, 10)
  if (Number.isNaN(groupId)) {
    throw new Error('组别 ID 无效')
  }

  const settings = await listSocialPushGroups()
  const group = (settings.groups || []).find((item) => item.id === groupId)
  if (!group) {
    throw new Error('分组不存在')
  }

  await saveSocialPushGroup({
    id: groupId,
    internalName: group.pendingInternalName || group.currentInternalName || group.internalName,
    sortOrder: group.pendingInternalName ? group.pendingSortOrder : group.currentSortOrder,
    isActive: false,
    selectedRoles: group.pendingRoles.length > 0 ? group.pendingRoles : group.currentRoles,
    effectiveDate: settings.tomorrow
  })

  return listSocialPushGroups()
}

export async function notifySocialPushFailure(error, title = '社群推送接口异常') {
  await createAdminMessageOnce({
    type: 'system_error',
    title,
    content: String(error?.message || 'Unknown error')
  }).catch((messageError) => {
    console.error('[SocialPush] Failed to record admin message:', messageError)
  })
}
