import neonHelper from '../../server-utils/dal/neon-helper.js'
import { createAdminMessageOnce } from './admin-message-service.js'

const RUNS_TABLE = 'admin_daily_job_email_runs'
const HISTORY_TABLE = 'admin_daily_job_email_history'
const DEFAULT_RECIPIENT = process.env.ADMIN_DAILY_DIGEST_EMAIL || 'hi@haigooremote.com'
const DEFAULT_TIMEZONE = process.env.ADMIN_DAILY_DIGEST_TIMEZONE || 'Asia/Shanghai'
const DEFAULT_TARGET_COUNT = clampTargetCount(process.env.ADMIN_DAILY_DIGEST_JOB_COUNT)
const DEFAULT_SITE_URL = String(process.env.SITE_URL || 'https://haigooremote.com').replace(/\/$/, '')
const EXPECTED_SEND_HOUR = 10
const EXPECTED_SEND_MINUTE = 0
const DIGEST_SCHEMA_ERROR_CODE = 'ADMIN_DAILY_DIGEST_SCHEMA_MISSING'
const MAX_JOBS_PER_COMPANY_PER_AUDIENCE = 2

const AUDIENCE_CONFIG = {
  public: {
    key: 'public',
    groupLabel: '非会员群',
    titleSuffix: '精选推送',
    repeatWindowDays: 3,
    priorityBuckets: ['featured-public', 'fallback-public'],
    ruleSummary: '精选优先，排除会员专属岗位，近 3 天内不重复。'
  },
  member: {
    key: 'member',
    groupLabel: '会员群',
    titleSuffix: '会员专属推送',
    repeatWindowDays: 5,
    priorityBuckets: ['member-exclusive', 'featured-public', 'fallback-public'],
    ruleSummary: '会员专属岗位优先，其次精选岗位，近 5 天内不重复。'
  }
}

const SOURCE_BUCKET_META = {
  'member-exclusive': {
    label: '会员专属',
    countsAsFallback: false
  },
  'featured-public': {
    label: '精选池',
    countsAsFallback: false
  },
  'fallback-public': {
    label: '普通池补位',
    countsAsFallback: true
  }
}

const JOB_TYPE_LABELS = {
  'full-time': '全职',
  full_time: '全职',
  fulltime: '全职',
  'part-time': '兼职',
  part_time: '兼职',
  parttime: '兼职',
  contract: '合同制',
  freelance: '自由职业',
  internship: '实习',
  intern: '实习',
  project: '项目制',
  temporary: '短期'
}

const EXPERIENCE_LEVEL_LABELS = {
  internship: '实习',
  intern: '实习',
  entry: '初级',
  junior: '初级',
  mid: '中级',
  middle: '中级',
  senior: '高级',
  lead: '负责人',
  manager: '经理',
  director: '总监',
  executive: '高管'
}

const EMAIL_TYPE_LABELS = {
  hr: 'HR',
  recruiting: '招聘',
  recruiter: '招聘',
  referral: '内推',
  direct: '直招',
  general: '通用',
  business: '业务',
  hiring: '招聘'
}

function clampTargetCount(value) {
  const numeric = Number.parseInt(value, 10)
  if (Number.isNaN(numeric)) return 5
  return Math.max(3, Math.min(5, numeric))
}

function parseDbJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

function normalizeCompanyKey(value) {
  return normalizeText(value).toLowerCase()
}

function createDigestSchemaError(message = 'Admin daily digest tables are missing') {
  const error = new Error(message)
  error.code = DIGEST_SCHEMA_ERROR_CODE
  return error
}

function isDigestSchemaError(error) {
  return error?.code === DIGEST_SCHEMA_ERROR_CODE
}

async function ensureDigestTablesReady() {
  const rows = await neonHelper.query(
    `SELECT
       to_regclass('public.admin_daily_job_email_runs') AS runs_table,
       to_regclass('public.admin_daily_job_email_history') AS history_table`
  )

  const row = rows?.[0] || {}
  if (!row.runs_table || !row.history_table) {
    throw createDigestSchemaError(
      '社群推送缓存依赖的数据表不存在，请先执行迁移 015_admin_daily_job_email.sql'
    )
  }
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

function getBatchLabel(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getDateParts(date, timeZone)
  return `${parts.year}年${parts.month}月${parts.day}日`
}

function getBatchLabelFromBatchDate(batchDate, fallbackDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const normalized = normalizeText(batchDate)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-')
    return `${year}年${month}月${day}日`
  }
  return getBatchLabel(fallbackDate, timeZone)
}

function buildSubject({ batchLabel, publicCount, memberCount }) {
  return `海狗远程俱乐部 ${batchLabel} 社群推送（非会员 ${publicCount} 条 / 会员 ${memberCount} 条）`
}

function buildJobDetailUrl(jobId) {
  const encodedId = encodeShareJobId(jobId)
  return `${DEFAULT_SITE_URL}/job/${encodedId}`
}

function encodeShareJobId(jobId) {
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

function buildJobShareUrl(jobId) {
  const encodedId = encodeShareJobId(jobId)
  return `${DEFAULT_SITE_URL}/job/${encodedId}?source=share`
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
    displayBatchDate,
    hasReachedRefreshTime
  }
}

function normalizeLocation(value) {
  const location = normalizeText(value, '全球远程')
  const lower = location.toLowerCase()
  if (lower === 'remote') return '全球远程'
  if (lower === 'global remote') return '全球远程'
  if (lower === 'remote - china') return '中国远程'
  return location
}

function normalizeCategory(value) {
  return normalizeText(value, '未分类')
}

function normalizeJobTypeLabel(value) {
  const normalized = normalizeText(value, '未标注')
  const lower = normalized.toLowerCase().replace(/\s+/g, '-')
  return JOB_TYPE_LABELS[lower] || normalized
}

function normalizeExperienceLevelLabel(value) {
  const normalized = normalizeText(value, '未标注')
  const lower = normalized.toLowerCase()
  return EXPERIENCE_LEVEL_LABELS[lower] || normalized
}

function normalizeEmailTypeLabel(value) {
  const normalized = normalizeText(value)
  if (!normalized) return '招聘'
  const lower = normalized.toLowerCase()
  return EMAIL_TYPE_LABELS[lower] || normalized.toUpperCase()
}

function mapJobRow(row, sourceBucket) {
  return {
    id: row.job_id,
    title: normalizeText(row.title, '未命名岗位'),
    company: normalizeText(row.company, '未知公司'),
    location: normalizeLocation(row.location),
    salary: normalizeText(row.salary),
    description: normalizeText(row.description),
    url: normalizeText(row.url),
    category: normalizeCategory(row.category),
    jobType: normalizeText(row.job_type),
    experienceLevel: normalizeText(row.experience_level),
    source: normalizeText(row.source),
    isFeatured: row.is_featured === true,
    canRefer: row.can_refer === true,
    hiringEmail: normalizeText(row.trusted_hiring_email),
    emailType: normalizeText(row.trusted_email_type),
    sourceBucket,
    sourceBucketLabel: SOURCE_BUCKET_META[sourceBucket]?.label || sourceBucket,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    detailUrl: buildJobDetailUrl(row.job_id),
    shareUrl: buildJobShareUrl(row.job_id),
    tags: Array.isArray(row.tags) ? row.tags : parseDbJson(row.tags, [])
  }
}

async function fetchExcludedJobIds(historyRecipient, batchDate, repeatWindowDays) {
  const lookbackDays = Math.max(Number(repeatWindowDays || 1) - 1, 0)
  const rows = await neonHelper.query(
    `SELECT job_id
     FROM ${HISTORY_TABLE}
     WHERE recipient = $1
       AND batch_date >= ($2::date - ($3::int * INTERVAL '1 day'))`,
    [historyRecipient, batchDate, lookbackDays]
  )

  return Array.from(new Set((rows || []).map((row) => String(row.job_id)).filter(Boolean)))
}

function getBucketSqlCondition(sourceBucket) {
  if (sourceBucket === 'member-exclusive') {
    return `COALESCE(j.can_refer, false) = true AND COALESCE(NULLIF(BTRIM(tc.hiring_email), ''), NULL) IS NOT NULL`
  }

  if (sourceBucket === 'featured-public') {
    return `COALESCE(j.can_refer, false) = false AND COALESCE(j.is_featured, false) = true`
  }

  if (sourceBucket === 'fallback-public') {
    return `COALESCE(j.can_refer, false) = false AND COALESCE(j.is_featured, false) = false`
  }

  throw new Error(`Unsupported source bucket: ${sourceBucket}`)
}

async function fetchCandidateJobs({ sourceBucket, limit, excludeIds = [] }) {
  if (limit <= 0) return []
  const candidateLimit = Math.min(Math.max(limit * 6, limit + 8), 80)

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
        j.source,
        j.tags,
        j.is_featured,
        j.can_refer,
        j.published_at,
        j.updated_at,
        j.created_at,
        tc.hiring_email AS trusted_hiring_email,
        tc.email_type AS trusted_email_type
     FROM jobs j
     LEFT JOIN trusted_companies tc ON j.company_id = tc.company_id
     WHERE j.status = 'active'
       AND j.is_approved = true
       AND COALESCE(NULLIF(BTRIM(j.title), ''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(BTRIM(j.company), ''), NULL) IS NOT NULL
       AND NOT (j.job_id = ANY($1))
       AND ${getBucketSqlCondition(sourceBucket)}
     ORDER BY COALESCE(j.published_at, j.updated_at, j.created_at) DESC NULLS LAST,
              j.updated_at DESC NULLS LAST,
              j.created_at DESC NULLS LAST,
              j.job_id DESC
     LIMIT $2`,
    [excludeIds, candidateLimit]
  )

  return (rows || []).map((row) => mapJobRow(row, sourceBucket))
}

function countCompanySelections(jobs) {
  const counts = new Map()
  for (const job of jobs || []) {
    const companyKey = normalizeCompanyKey(job?.company)
    if (!companyKey) continue
    counts.set(companyKey, (counts.get(companyKey) || 0) + 1)
  }
  return counts
}

function applyCompanySelectionLimit(candidateJobs, existingJobs = [], maxPerCompany = MAX_JOBS_PER_COMPANY_PER_AUDIENCE) {
  const companyCounts = countCompanySelections(existingJobs)
  const accepted = []

  for (const job of candidateJobs || []) {
    const companyKey = normalizeCompanyKey(job?.company)
    if (!companyKey) {
      accepted.push(job)
      continue
    }

    const currentCount = companyCounts.get(companyKey) || 0
    if (currentCount >= maxPerCompany) continue

    companyCounts.set(companyKey, currentCount + 1)
    accepted.push(job)
  }

  return accepted
}

async function claimDailyRun({ batchDate, recipient, timeZone, targetCount }) {
  const rows = await neonHelper.query(
    `INSERT INTO ${RUNS_TABLE} (
        batch_date,
        recipient,
        timezone,
        status,
        target_count,
        created_at,
        updated_at
     ) VALUES ($1, $2, $3, 'processing', $4, NOW(), NOW())
     ON CONFLICT (batch_date, recipient) DO NOTHING
     RETURNING *`,
    [batchDate, recipient, timeZone, targetCount]
  )

  if (rows?.[0]) {
    return { acquired: true, run: rows[0] }
  }

  const existing = await neonHelper.query(
    `SELECT *
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1 AND recipient = $2
     LIMIT 1`,
    [batchDate, recipient]
  )

  return { acquired: false, run: existing?.[0] || null }
}

async function claimForcedDailyRun({ batchDate, recipient, timeZone, targetCount }) {
  const existing = await neonHelper.query(
    `SELECT *
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1 AND recipient = $2
     LIMIT 1`,
    [batchDate, recipient]
  )

  if (!existing?.[0]) {
    return claimDailyRun({ batchDate, recipient, timeZone, targetCount })
  }

  const current = existing[0]
  if (current.status === 'sent' || current.status === 'processing') {
    return { acquired: false, run: current }
  }

  const rows = await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'processing',
         timezone = $2,
         target_count = $3,
         error = NULL,
         payload = NULL,
         sent_at = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [current.id, timeZone, targetCount]
  )

  return { acquired: true, run: rows?.[0] || current }
}

async function fetchDailyRun(batchDate, recipient) {
  const existing = await neonHelper.query(
    `SELECT *
     FROM ${RUNS_TABLE}
     WHERE batch_date = $1 AND recipient = $2
     LIMIT 1`,
    [batchDate, recipient]
  )

  return existing?.[0] || null
}

async function markRunReady(runId, details) {
  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'ready',
         sent_at = NOW(),
         job_count = $2,
         featured_count = $3,
         fallback_count = $4,
         subject = $5,
         payload = $6::jsonb,
         error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [
      runId,
      details.jobCount,
      details.featuredCount,
      details.fallbackCount,
      details.subject,
      JSON.stringify(details.payload || {})
    ]
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
    [
      runId,
      JSON.stringify(payload),
      String(error?.message || error || 'Unknown error').slice(0, 2000)
    ]
  )
}

async function recordAudienceHistory(runId, batchDate, selection) {
  for (const job of selection.jobs) {
    await neonHelper.query(
      `INSERT INTO ${HISTORY_TABLE} (
          run_id,
          batch_date,
          recipient,
          job_id,
          source_bucket,
          created_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (batch_date, recipient, job_id) DO NOTHING`,
      [runId, batchDate, selection.historyRecipient, String(job.id), job.sourceBucket]
    )
  }
}

function buildDigestPreviewResponse({ digest, timeZone, targetCount, source, schedule, run }) {
  return {
    success: true,
    preview: true,
    source,
    recipient: digest.recipient,
    timeZone,
    targetCount,
    batchDate: digest.batchDate,
    batchLabel: digest.batchLabel,
    subject: digest.subject,
    audiences: digest.audiences,
    totals: digest.totals,
    generatedAt: run?.sent_at || run?.updated_at || null,
    updatedAt: run?.updated_at || null,
    schedule: {
      ...schedule,
      displayBatchLabel: getBatchLabelFromBatchDate(schedule.displayBatchDate, new Date(), timeZone),
      currentBatchLabel: getBatchLabelFromBatchDate(schedule.currentBatchDate, new Date(), timeZone)
    }
  }
}

function parseRunPayload(run) {
  return parseDbJson(run?.payload, null)
}

function buildDigestFromStoredPayload(run, timeZone, targetCount, schedule) {
  const payload = parseRunPayload(run)
  if (!payload?.digest) return null

  return buildDigestPreviewResponse({
    digest: payload.digest,
    timeZone,
    targetCount: payload.targetCount || targetCount,
    source: 'cache',
    schedule,
    run
  })
}

async function claimDigestGeneration({ batchDate, recipient, timeZone, targetCount }) {
  const existing = await fetchDailyRun(batchDate, recipient)

  if (!existing) {
    return claimDailyRun({ batchDate, recipient, timeZone, targetCount })
  }

  if ((existing.status === 'ready' || existing.status === 'sent') && parseRunPayload(existing)?.digest) {
    return { acquired: false, run: existing }
  }

  const rows = await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'processing',
         timezone = $2,
         target_count = $3,
         error = NULL,
         payload = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existing.id, timeZone, targetCount]
  )

  return { acquired: true, run: rows?.[0] || existing }
}

function buildJobMetaLine(job) {
  return [
    `地点：${normalizeLocation(job.location)}`,
    `岗位分类：${normalizeCategory(job.category)}`,
    `岗位类型：${normalizeJobTypeLabel(job.jobType)}`,
    `岗位级别：${normalizeExperienceLevelLabel(job.experienceLevel)}`
  ].join('｜')
}

function buildApplicationLine(job, audienceKey) {
  if (audienceKey === 'member' && job.canRefer && job.hiringEmail) {
    return `岗位内推邮箱：${normalizeEmailTypeLabel(job.emailType)}邮箱 ${job.hiringEmail}`
  }
  return `申请链接：${job.shareUrl || job.detailUrl}`
}

function buildAudienceTitle(batchLabel, audienceKey) {
  const config = AUDIENCE_CONFIG[audienceKey]
  return `海狗远程俱乐部 ${batchLabel} ${config.titleSuffix}`
}

function buildAudienceCopyText(audienceKey, batchLabel, jobs) {
  const title = buildAudienceTitle(batchLabel, audienceKey)
  if (!jobs.length) {
    return `${title}\n\n今日暂无符合条件的岗位。`
  }

  const blocks = jobs.map((job) => [
    `【${job.title}】`,
    `【${job.company}】`,
    buildJobMetaLine(job),
    buildApplicationLine(job, audienceKey)
  ].join('\n'))

  return `${title}\n\n${blocks.join('\n\n')}`
}

function summarizeJobsForPreview(audienceKey, jobs) {
  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: normalizeLocation(job.location),
    category: normalizeCategory(job.category),
    jobType: normalizeJobTypeLabel(job.jobType),
    experienceLevel: normalizeExperienceLevelLabel(job.experienceLevel),
    sourceBucket: job.sourceBucket,
    sourceBucketLabel: job.sourceBucketLabel,
    canRefer: job.canRefer,
    hiringEmail: job.hiringEmail,
    emailTypeLabel: normalizeEmailTypeLabel(job.emailType),
    detailUrl: job.detailUrl,
    shareUrl: job.shareUrl || job.detailUrl,
    applyLine: buildApplicationLine(job, audienceKey),
    metaLine: buildJobMetaLine(job)
  }))
}

async function selectAudienceJobs({ batchDate, recipient, audienceKey, targetCount }) {
  const config = AUDIENCE_CONFIG[audienceKey]
  const historyRecipient = `${recipient}::${audienceKey}`
  const recentJobIds = await fetchExcludedJobIds(historyRecipient, batchDate, config.repeatWindowDays)
  const jobs = []
  const bucketCounts = {}

  for (const sourceBucket of config.priorityBuckets) {
    const remaining = targetCount - jobs.length
    if (remaining <= 0) break

    const bucketJobs = await fetchCandidateJobs({
      sourceBucket,
      limit: remaining,
      excludeIds: recentJobIds.concat(jobs.map((job) => String(job.id)))
    })

    const limitedBucketJobs = applyCompanySelectionLimit(bucketJobs, jobs)
    bucketCounts[sourceBucket] = limitedBucketJobs.length
    jobs.push(...limitedBucketJobs.slice(0, remaining))
  }

  const preferredCount = jobs.filter((job) => !SOURCE_BUCKET_META[job.sourceBucket]?.countsAsFallback).length
  const fallbackCount = jobs.length - preferredCount

  return {
    audienceKey,
    historyRecipient,
    repeatWindowDays: config.repeatWindowDays,
    groupLabel: config.groupLabel,
    ruleSummary: config.ruleSummary,
    recentExcludedCount: recentJobIds.length,
    preferredCount,
    fallbackCount,
    bucketCounts,
    jobs
  }
}

async function buildDigestPayload({ batchDate, batchLabel, recipient, targetCount }) {
  const publicSelection = await selectAudienceJobs({
    batchDate,
    recipient,
    audienceKey: 'public',
    targetCount
  })

  const memberSelection = await selectAudienceJobs({
    batchDate,
    recipient,
    audienceKey: 'member',
    targetCount
  })

  const publicPreview = {
    key: 'public',
    groupLabel: publicSelection.groupLabel,
    title: buildAudienceTitle(batchLabel, 'public'),
    repeatWindowDays: publicSelection.repeatWindowDays,
    ruleSummary: publicSelection.ruleSummary,
    recentExcludedCount: publicSelection.recentExcludedCount,
    preferredCount: publicSelection.preferredCount,
    fallbackCount: publicSelection.fallbackCount,
    jobCount: publicSelection.jobs.length,
    copyText: buildAudienceCopyText('public', batchLabel, publicSelection.jobs),
    jobs: summarizeJobsForPreview('public', publicSelection.jobs)
  }

  const memberPreview = {
    key: 'member',
    groupLabel: memberSelection.groupLabel,
    title: buildAudienceTitle(batchLabel, 'member'),
    repeatWindowDays: memberSelection.repeatWindowDays,
    ruleSummary: memberSelection.ruleSummary,
    recentExcludedCount: memberSelection.recentExcludedCount,
    preferredCount: memberSelection.preferredCount,
    fallbackCount: memberSelection.fallbackCount,
    jobCount: memberSelection.jobs.length,
    copyText: buildAudienceCopyText('member', batchLabel, memberSelection.jobs),
    jobs: summarizeJobsForPreview('member', memberSelection.jobs)
  }

  const totalJobs = publicSelection.jobs.length + memberSelection.jobs.length
  const preferredCount = publicSelection.preferredCount + memberSelection.preferredCount
  const fallbackCount = publicSelection.fallbackCount + memberSelection.fallbackCount

  return {
    batchDate,
    batchLabel,
    recipient,
    targetCount,
    subject: buildSubject({
      batchLabel,
      publicCount: publicPreview.jobCount,
      memberCount: memberPreview.jobCount
    }),
    audiences: {
      public: publicPreview,
      member: memberPreview
    },
    selections: {
      public: publicSelection,
      member: memberSelection
    },
    totals: {
      totalJobs,
      preferredCount,
      fallbackCount
    }
  }
}

export function getAdminDailyJobEmailConfig() {
  const schedule = getScheduleContext(new Date(), DEFAULT_TIMEZONE)
  return {
    recipient: DEFAULT_RECIPIENT,
    timeZone: DEFAULT_TIMEZONE,
    targetCount: DEFAULT_TARGET_COUNT,
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
    await ensureDigestTablesReady()
  } catch (error) {
    if (isDigestSchemaError(error)) {
      return {
        success: true,
        health: 'unknown',
        message: error.message,
        migrationRequired: true
      }
    }
    throw error
  }

  const recipient = normalizeText(options.recipient, DEFAULT_RECIPIENT)
  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const now = options.now instanceof Date ? options.now : new Date()
  const schedule = getScheduleContext(now, timeZone)
  const batchDate = options.batchDate || schedule.displayBatchDate
  const run = await fetchDailyRun(batchDate, recipient)

  let health = 'ok'
  let message = `${batchDate} 批次社群推送缓存正常`

  if (!run) {
    health = schedule.hasReachedRefreshTime ? 'warning' : 'waiting'
    message = schedule.hasReachedRefreshTime
      ? `${batchDate} 批次尚未生成，可在社群推送页手动刷新`
      : `${batchDate} 批次尚未到自动更新时间`
  } else if (run.status === 'failed') {
    health = 'error'
    message = `${batchDate} 批次生成失败：${normalizeText(run.error, '未知错误')}`
  } else if (run.status === 'processing') {
    health = 'warning'
    message = `${batchDate} 批次正在生成中`
  }

  return {
    success: true,
    health,
    message,
    batchDate,
    recipient,
    timeZone,
    schedule,
    run: run ? {
      id: run.id,
      status: run.status,
      sentAt: run.sent_at,
      updatedAt: run.updated_at,
      error: run.error,
      jobCount: Number(run.job_count || 0),
      featuredCount: Number(run.featured_count || 0),
      fallbackCount: Number(run.fallback_count || 0)
    } : null
  }
}

async function ensureAdminDailyJobDigest(options = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  await ensureDigestTablesReady()

  const recipient = normalizeText(options.recipient, DEFAULT_RECIPIENT)
  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const targetCount = clampTargetCount(options.targetCount || DEFAULT_TARGET_COUNT)
  const now = options.now instanceof Date ? options.now : new Date()
  const baseSchedule = getScheduleContext(now, timeZone)
  let batchDate = options.batchDate
    || (options.forceCurrentBatch === true ? baseSchedule.currentBatchDate : baseSchedule.displayBatchDate)

  if (!options.batchDate && options.forceCurrentBatch !== true && baseSchedule.hasReachedRefreshTime === false) {
    const todayRun = await fetchDailyRun(baseSchedule.currentBatchDate, recipient)
    if (buildDigestFromStoredPayload(todayRun, timeZone, targetCount, {
      ...baseSchedule,
      displayBatchDate: baseSchedule.currentBatchDate
    })) {
      batchDate = baseSchedule.currentBatchDate
    }
  }

  const schedule = {
    ...baseSchedule,
    displayBatchDate: batchDate
  }
  const batchLabel = getBatchLabelFromBatchDate(batchDate, now, timeZone)
  const cachedRun = await fetchDailyRun(batchDate, recipient)
  const cachedPreview = buildDigestFromStoredPayload(cachedRun, timeZone, targetCount, schedule)

  if (cachedPreview) {
    return cachedPreview
  }

  const claimed = await claimDigestGeneration({ batchDate, recipient, timeZone, targetCount })
  const run = claimed.run

  if (!claimed.acquired) {
    const preview = buildDigestFromStoredPayload(run, timeZone, targetCount, schedule)
    if (preview) return preview
  }

  const digest = await buildDigestPayload({ batchDate, batchLabel, recipient, targetCount })

  try {
    if (run?.id) {
      await recordAudienceHistory(run.id, batchDate, digest.selections.public)
      await recordAudienceHistory(run.id, batchDate, digest.selections.member)
      await markRunReady(run.id, {
        jobCount: digest.totals.totalJobs,
        featuredCount: digest.totals.preferredCount,
        fallbackCount: digest.totals.fallbackCount,
        subject: digest.subject,
        payload: {
          targetCount,
          digest: {
            batchDate: digest.batchDate,
            batchLabel: digest.batchLabel,
            recipient: digest.recipient,
            subject: digest.subject,
            audiences: digest.audiences,
            totals: digest.totals
          }
        }
      })
    }

    const updatedRun = run?.id ? await fetchDailyRun(batchDate, recipient) : run
    return buildDigestPreviewResponse({
      digest,
      timeZone,
      targetCount,
      source: 'generated',
      schedule,
      run: updatedRun
    })
  } catch (error) {
    if (run?.id) {
      await markRunFailed(run.id, error, {
        targetCount,
        batchDate,
        recipient
      })
    }

    await createAdminMessageOnce({
      type: 'system_error',
      title: '社群推送生成失败',
      content: `${batchDate} 批次生成失败：${normalizeText(error?.message, '未知错误')}`
    })

    throw error
  }
}

export async function previewAdminDailyJobEmail(options = {}) {
  return ensureAdminDailyJobDigest({
    ...options,
    forceCurrentBatch: false
  })
}

export async function refreshAdminDailyJobEmail(options = {}) {
  return ensureAdminDailyJobDigest({
    ...options,
    forceCurrentBatch: true
  })
}

export async function sendAdminDailyJobEmail(options = {}) {
  return refreshAdminDailyJobEmail(options)
}
