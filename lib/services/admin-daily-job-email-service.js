import neonHelper from '../../server-utils/dal/neon-helper.js'
import {
  isEmailServiceConfigured,
  sendAdminDailyFeaturedJobsEmail
} from '../../server-utils/email-service.js'
import { createAdminMessageOnce } from './admin-message-service.js'

const RUNS_TABLE = 'admin_daily_job_email_runs'
const HISTORY_TABLE = 'admin_daily_job_email_history'
const DEFAULT_RECIPIENT = process.env.ADMIN_DAILY_DIGEST_EMAIL || 'hi@haigooremote.com'
const DEFAULT_TIMEZONE = process.env.ADMIN_DAILY_DIGEST_TIMEZONE || 'Asia/Shanghai'
const DEFAULT_TARGET_COUNT = clampTargetCount(process.env.ADMIN_DAILY_DIGEST_JOB_COUNT)
const EXPECTED_SEND_HOUR = 10
const EXPECTED_SEND_MINUTE = 0
const MONITOR_GRACE_MINUTES = 20

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

function buildSubject({ batchLabel, jobCount, featuredCount, fallbackCount }) {
  const featuredText = featuredCount > 0 ? `${featuredCount} 条精选` : '0 条精选'
  const fallbackText = fallbackCount > 0 ? `，${fallbackCount} 条补充` : ''
  return `Haigoo 每日精选岗位 ${batchLabel}（共 ${jobCount} 条，${featuredText}${fallbackText}）`
}

function mapJobRow(row, sourceBucket) {
  return {
    id: row.job_id,
    title: normalizeText(row.title, '未命名岗位'),
    company: normalizeText(row.company, '未知公司'),
    location: normalizeText(row.location, 'Remote'),
    salary: normalizeText(row.salary),
    description: normalizeText(row.description),
    url: normalizeText(row.url),
    category: normalizeText(row.category),
    jobType: normalizeText(row.job_type),
    experienceLevel: normalizeText(row.experience_level),
    source: normalizeText(row.source),
    isFeatured: row.is_featured === true,
    sourceBucket,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    tags: Array.isArray(row.tags) ? row.tags : parseDbJson(row.tags, [])
  }
}

async function fetchExcludedJobIds(recipient, batchDate) {
  const rows = await neonHelper.query(
    `SELECT job_id
     FROM ${HISTORY_TABLE}
     WHERE recipient = $1
       AND batch_date >= ($2::date - INTERVAL '5 days')`,
    [recipient, batchDate]
  )

  return Array.from(new Set((rows || []).map((row) => String(row.job_id)).filter(Boolean)))
}

async function fetchCandidateJobs({ featuredOnly, limit, excludeIds = [] }) {
  if (limit <= 0) return []

  const rows = await neonHelper.query(
    `SELECT
        job_id,
        title,
        company,
        location,
        salary,
        description,
        url,
        category,
        job_type,
        experience_level,
        source,
        tags,
        is_featured,
        published_at,
        updated_at,
        created_at
     FROM jobs
     WHERE status = 'active'
       AND is_approved = true
       AND COALESCE(NULLIF(BTRIM(title), ''), NULL) IS NOT NULL
       AND COALESCE(NULLIF(BTRIM(company), ''), NULL) IS NOT NULL
       AND NOT (job_id = ANY($1))
       AND COALESCE(is_featured, false) = $2
     ORDER BY COALESCE(published_at, updated_at, created_at) DESC NULLS LAST,
              updated_at DESC NULLS LAST,
              created_at DESC NULLS LAST,
              job_id DESC
     LIMIT $3`,
    [excludeIds, featuredOnly, limit]
  )

  return (rows || []).map((row) => mapJobRow(row, featuredOnly ? 'featured' : 'fallback'))
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

async function markRunSent(runId, details) {
  await neonHelper.query(
    `UPDATE ${RUNS_TABLE}
     SET status = 'sent',
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

async function markRunSkipped(runId, reason, payload = {}) {
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

async function recordHistory(runId, batchDate, recipient, jobs) {
  for (const job of jobs) {
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
      [runId, batchDate, recipient, String(job.id), job.sourceBucket]
    )
  }
}

async function selectDigestJobs({ batchDate, recipient, targetCount }) {
  const recentJobIds = await fetchExcludedJobIds(recipient, batchDate)
  const featuredJobs = await fetchCandidateJobs({
    featuredOnly: true,
    limit: targetCount,
    excludeIds: recentJobIds
  })

  const fallbackJobs = featuredJobs.length < targetCount
    ? await fetchCandidateJobs({
      featuredOnly: false,
      limit: targetCount - featuredJobs.length,
      excludeIds: recentJobIds.concat(featuredJobs.map((job) => String(job.id)))
    })
    : []

  return {
    recentExcludedCount: recentJobIds.length,
    featuredJobs,
    fallbackJobs,
    jobs: featuredJobs.concat(fallbackJobs)
  }
}

export function getAdminDailyJobEmailConfig() {
  return {
    recipient: DEFAULT_RECIPIENT,
    timeZone: DEFAULT_TIMEZONE,
    targetCount: DEFAULT_TARGET_COUNT,
    emailConfigured: isEmailServiceConfigured(),
    databaseConfigured: Boolean(neonHelper.isConfigured)
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

  const recipient = normalizeText(options.recipient, DEFAULT_RECIPIENT)
  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const now = options.now instanceof Date ? options.now : new Date()
  const batchDate = options.batchDate || getBatchDate(now, timeZone)
  const run = await fetchDailyRun(batchDate, recipient)
  const timeParts = getTimeParts(now, timeZone)
  const currentMinute = (timeParts.hour * 60) + timeParts.minute
  const expectedMinute = (EXPECTED_SEND_HOUR * 60) + EXPECTED_SEND_MINUTE

  let health = 'ok'
  let message = '管理员每日精选邮件状态正常'
  let title = ''
  let alertType = 'system_notice'

  if (!run) {
    if (currentMinute >= expectedMinute + MONITOR_GRACE_MINUTES) {
      health = 'error'
      title = '定时任务未执行：管理员每日精选邮件'
      message = `${batchDate} 批次在计划时间后仍无执行记录，请检查 Vercel Cron 或手动补跑。`
      alertType = 'system_error'
    } else {
      health = 'waiting'
      message = `${batchDate} 批次尚未到计划执行窗口`
    }
  } else if (run.status === 'failed') {
    health = 'error'
    title = '定时任务异常：管理员每日精选邮件'
    message = `${batchDate} 批次执行失败：${normalizeText(run.error, '未知错误')}`
    alertType = 'system_error'
  } else if (run.status === 'skipped') {
    health = 'warning'
    title = '定时任务未发送：管理员每日精选邮件'
    message = `${batchDate} 批次未发送：${normalizeText(run.error, '无可用岗位')}`
  } else if (run.status === 'processing') {
    health = 'warning'
    message = `${batchDate} 批次正在执行中`
  } else if (run.status === 'sent') {
    message = `${batchDate} 批次已发送 ${Number(run.job_count || 0)} 条岗位`
  } else {
    health = 'warning'
    title = '定时任务状态异常：管理员每日精选邮件'
    message = `${batchDate} 批次状态为 ${normalizeText(run.status, 'unknown')}`
  }

  if (title) {
    await createAdminMessageOnce({
      type: alertType,
      title,
      content: message
    })
  }

  return {
    success: true,
    health,
    message,
    batchDate,
    recipient,
    timeZone,
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

export async function previewAdminDailyJobEmail(options = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  const recipient = normalizeText(options.recipient, DEFAULT_RECIPIENT)
  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const targetCount = clampTargetCount(options.targetCount || DEFAULT_TARGET_COUNT)
  const now = options.now instanceof Date ? options.now : new Date()
  const batchDate = options.batchDate || getBatchDate(now, timeZone)
  const batchLabel = getBatchLabel(now, timeZone)
  const selection = await selectDigestJobs({ batchDate, recipient, targetCount })

  return {
    success: true,
    preview: true,
    recipient,
    timeZone,
    targetCount,
    batchDate,
    batchLabel,
    featuredCount: selection.featuredJobs.length,
    fallbackCount: selection.fallbackJobs.length,
    recentExcludedCount: selection.recentExcludedCount,
    jobs: selection.jobs
  }
}

export async function sendAdminDailyJobEmail(options = {}) {
  if (!neonHelper.isConfigured) {
    throw new Error('Database not configured')
  }

  if (!isEmailServiceConfigured()) {
    throw new Error('Email service not configured')
  }

  const recipient = normalizeText(options.recipient, DEFAULT_RECIPIENT)
  const timeZone = normalizeText(options.timeZone, DEFAULT_TIMEZONE)
  const targetCount = clampTargetCount(options.targetCount || DEFAULT_TARGET_COUNT)
  const now = options.now instanceof Date ? options.now : new Date()
  const batchDate = options.batchDate || getBatchDate(now, timeZone)
  const batchLabel = getBatchLabel(now, timeZone)
  const force = options.force === true

  let run = null

  const claimed = force
    ? await claimForcedDailyRun({ batchDate, recipient, timeZone, targetCount })
    : await claimDailyRun({ batchDate, recipient, timeZone, targetCount })

  run = claimed.run

  if (!claimed.acquired) {
    const existingStatus = normalizeText(run?.status)
    return {
      success: true,
      skipped: true,
      reason: existingStatus === 'sent' ? 'already_sent' : 'already_started',
      message: existingStatus === 'sent'
        ? `Admin daily job email already sent for ${batchDate}`
        : `Admin daily job email already has a ${existingStatus || 'running'} record for ${batchDate}`,
      batchDate,
      recipient,
      runId: run?.id || null,
      status: existingStatus || null
    }
  }

  const runId = run?.id
  const selection = await selectDigestJobs({ batchDate, recipient, targetCount })
  const jobs = selection.jobs

  if (!jobs.length) {
    if (runId) {
      await markRunSkipped(runId, 'No eligible jobs available for admin daily digest', {
        batchDate,
        recipient,
        targetCount,
        recentExcludedCount: selection.recentExcludedCount
      })
    }

    await createAdminMessageOnce({
      type: 'system_notice',
      title: '定时任务未发送：管理员每日精选邮件',
      content: `${batchDate} 批次没有符合条件的岗位可发送。`
    })

    return {
      success: true,
      skipped: true,
      reason: 'no_jobs_available',
      message: 'No eligible jobs available for admin daily digest',
      batchDate,
      recipient,
      runId: runId || null,
      featuredCount: 0,
      fallbackCount: 0,
      recentExcludedCount: selection.recentExcludedCount
    }
  }

  const featuredCount = selection.featuredJobs.length
  const fallbackCount = selection.fallbackJobs.length
  const subject = buildSubject({
    batchLabel,
    jobCount: jobs.length,
    featuredCount,
    fallbackCount
  })

  try {
    const sent = await sendAdminDailyFeaturedJobsEmail(recipient, jobs, {
      batchDate,
      batchLabel,
      featuredCount,
      fallbackCount,
      recentExcludedCount: selection.recentExcludedCount,
      targetCount,
      subject
    })

    if (!sent) {
      throw new Error('Email provider returned a failed response')
    }

    if (runId) {
      await recordHistory(runId, batchDate, recipient, jobs)
      await markRunSent(runId, {
        jobCount: jobs.length,
        featuredCount,
        fallbackCount,
        subject,
        payload: {
          batchDate,
          recipient,
          targetCount,
          recentExcludedCount: selection.recentExcludedCount,
          jobIds: jobs.map((job) => job.id)
        }
      })
    }

    return {
      success: true,
      sent: true,
      batchDate,
      batchLabel,
      recipient,
      runId: runId || null,
      targetCount,
      jobCount: jobs.length,
      featuredCount,
      fallbackCount,
      recentExcludedCount: selection.recentExcludedCount,
      subject,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        sourceBucket: job.sourceBucket
      }))
    }
  } catch (error) {
    if (runId) {
      await markRunFailed(runId, error, {
        batchDate,
        recipient,
        targetCount,
        recentExcludedCount: selection.recentExcludedCount,
        jobIds: jobs.map((job) => job.id)
      })
    }

    await createAdminMessageOnce({
      type: 'system_error',
      title: '定时任务异常：管理员每日精选邮件',
      content: `${batchDate} 批次执行失败：${normalizeText(error?.message, '未知错误')}`
    })

    throw error
  }
}
