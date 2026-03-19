import { randomUUID } from 'node:crypto'

import neonHelper from '../../server-utils/dal/neon-helper.js'
import { systemSettingsService } from './system-settings-service.js'

const PUSH_QUEUE_TABLE = 'wecom_aibot_push_queue'
const DEFAULT_CHAT_ID_SETTING = 'wecom_aibot_default_chatid'
const LAST_GROUP_CHAT_ID_SETTING = 'wecom_aibot_last_group_chatid'
const DEFAULT_SITE_URL = 'https://haigooremote.com'
const DEFAULT_MAX_RETRIES = Number(process.env.WECOM_AIBOT_MAX_RETRIES || 6)
const DEFAULT_RETRY_DELAY_SECONDS = Number(process.env.WECOM_AIBOT_RETRY_DELAY_SECONDS || 120)

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

function normalizeSettingValue(value) {
  const parsed = parseDbJson(value, value)
  if (typeof parsed === 'string') return normalizeText(parsed)
  return parsed
}

function escapeMarkdown(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_~>])/g, '\\$1')
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function buildJobApprovalDedupeKey(jobId) {
  return `job-approved:${jobId}`
}

export function buildWecomReqId(prefix = 'haigoo') {
  return `${prefix}-${randomUUID()}`
}

export async function fetchJobApprovalStates(jobIds = []) {
  const ids = Array.from(new Set((jobIds || []).filter(Boolean)))
  if (!ids.length || !neonHelper.isConfigured) return new Map()

  const rows = await neonHelper.query(
    'SELECT job_id, is_approved FROM jobs WHERE job_id = ANY($1)',
    [ids]
  )

  return new Map((rows || []).map((row) => [row.job_id, row.is_approved === true]))
}

function buildQueuePayload(job) {
  return {
    jobId: job.id,
    title: normalizeText(job.title, '未命名岗位'),
    company: normalizeText(job.company, '未知公司'),
    location: normalizeText(job.location, 'Remote'),
    salary: normalizeText(job.salary),
    category: normalizeText(job.category),
    jobType: normalizeText(job.jobType),
    experienceLevel: normalizeText(job.experienceLevel),
    source: normalizeText(job.source),
    url: normalizeText(job.url),
    publishedAt: job.publishedAt || null,
    isRemote: Boolean(job.isRemote),
    tags: Array.isArray(job.tags) ? job.tags.slice(0, 6).map((tag) => normalizeText(tag)).filter(Boolean) : [],
    approvedAt: new Date().toISOString()
  }
}

export async function enqueueApprovedJobPushes(jobs = [], options = {}) {
  if (!neonHelper.isConfigured || !Array.isArray(jobs) || jobs.length === 0) {
    return []
  }

  const previousStates = options.previousStates instanceof Map
    ? options.previousStates
    : await fetchJobApprovalStates(jobs.map((job) => job?.id))

  const candidates = jobs.filter((job) => {
    if (!job?.id) return false
    if (job.isApproved !== true) return false
    if (job.status && job.status !== 'active') return false
    return previousStates.get(job.id) !== true
  })

  if (!candidates.length) return []

  const enqueued = []

  for (const job of candidates) {
    const dedupeKey = buildJobApprovalDedupeKey(job.id)
    const payload = buildQueuePayload(job)

    const rows = await neonHelper.query(
      `INSERT INTO ${PUSH_QUEUE_TABLE} (
        channel,
        event_type,
        job_id,
        dedupe_key,
        payload,
        status,
        available_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', NOW(), NOW(), NOW())
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id, job_id, status`,
      ['wecom_aibot', 'job_approved', job.id, dedupeKey, JSON.stringify(payload)]
    )

    if (rows?.[0]) {
      enqueued.push(rows[0])
    }
  }

  return enqueued
}

export async function claimNextWecomPushTask() {
  if (!neonHelper.isConfigured) return null

  const rows = await neonHelper.query(
    `WITH next_task AS (
      SELECT id
      FROM ${PUSH_QUEUE_TABLE}
      WHERE channel = 'wecom_aibot'
        AND status IN ('pending', 'retry')
        AND available_at <= NOW()
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${PUSH_QUEUE_TABLE} queue
    SET status = 'processing',
        attempts = queue.attempts + 1,
        locked_at = NOW(),
        updated_at = NOW()
    FROM next_task
    WHERE queue.id = next_task.id
    RETURNING queue.*`
  )

  if (!rows?.[0]) return null

  return {
    ...rows[0],
    payload: parseDbJson(rows[0].payload, {})
  }
}

export async function markWecomPushTaskSent(taskId, response = null) {
  if (!neonHelper.isConfigured || !taskId) return false

  await neonHelper.query(
    `UPDATE ${PUSH_QUEUE_TABLE}
     SET status = 'sent',
         sent_at = NOW(),
         locked_at = NULL,
         last_error = NULL,
         response = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [taskId, JSON.stringify(response || {})]
  )

  return true
}

export async function markWecomPushTaskFailed(task, error) {
  if (!neonHelper.isConfigured || !task?.id) return false

  const attempts = Number(task.attempts || 0)
  const shouldRetry = attempts < DEFAULT_MAX_RETRIES
  const delaySeconds = DEFAULT_RETRY_DELAY_SECONDS * Math.max(1, attempts)

  await neonHelper.query(
    `UPDATE ${PUSH_QUEUE_TABLE}
     SET status = $2,
         available_at = CASE
           WHEN $2 = 'retry' THEN NOW() + ($4 * INTERVAL '1 second')
           ELSE available_at
         END,
         locked_at = NULL,
         last_error = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [
      task.id,
      shouldRetry ? 'retry' : 'failed',
      String(error?.message || error || 'Unknown error').slice(0, 2000),
      delaySeconds
    ]
  )

  return true
}

export async function rememberWecomGroupChat(chatid) {
  if (!chatid) return null

  await systemSettingsService.setSetting(
    LAST_GROUP_CHAT_ID_SETTING,
    chatid,
    'Latest Enterprise WeCom aibot group chat id observed from callback'
  )

  const currentDefault = process.env.WECOM_AIBOT_CHAT_ID || await systemSettingsService.getSetting(DEFAULT_CHAT_ID_SETTING)
  if (!currentDefault) {
    await systemSettingsService.setSetting(
      DEFAULT_CHAT_ID_SETTING,
      chatid,
      'Default Enterprise WeCom aibot group chat id for approved job pushes'
    )
  }

  return chatid
}

export async function resolveWecomTargetChatId(explicitChatId = null) {
  if (explicitChatId) return explicitChatId
  if (process.env.WECOM_AIBOT_CHAT_ID) return process.env.WECOM_AIBOT_CHAT_ID

  const configuredChatId = normalizeSettingValue(await systemSettingsService.getSetting(DEFAULT_CHAT_ID_SETTING))
  if (configuredChatId) return configuredChatId

  return normalizeSettingValue(await systemSettingsService.getSetting(LAST_GROUP_CHAT_ID_SETTING))
}

export function formatApprovedJobMarkdown(job, options = {}) {
  const siteUrl = String(options.siteUrl || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
  const title = escapeMarkdown(normalizeText(job.title, '未命名岗位'))
  const company = escapeMarkdown(normalizeText(job.company, '未知公司'))
  const location = escapeMarkdown(normalizeText(job.location, 'Remote'))
  const salary = normalizeText(job.salary)
  const category = normalizeText(job.category)
  const jobType = normalizeText(job.jobType)
  const experienceLevel = normalizeText(job.experienceLevel)
  const source = normalizeText(job.source)
  const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean).slice(0, 4).map((tag) => `\`${escapeMarkdown(tag)}\``) : []
  const url = normalizeText(job.url)
  const publishedAt = formatDate(job.publishedAt)
  const detailUrl = job.jobId ? `${siteUrl}/jobs?jobId=${encodeURIComponent(job.jobId)}` : ''

  const lines = [
    `## ${title}`,
    `**公司**：${company}`,
    `**地点**：${location}`
  ]

  if (salary) lines.push(`**薪资**：${escapeMarkdown(salary)}`)
  if (category) lines.push(`**分类**：${escapeMarkdown(category)}`)
  if (jobType) lines.push(`**类型**：${escapeMarkdown(jobType)}`)
  if (experienceLevel) lines.push(`**级别**：${escapeMarkdown(experienceLevel)}`)
  if (publishedAt) lines.push(`**发布日期**：${publishedAt}`)
  if (source) lines.push(`**来源**：${escapeMarkdown(source)}`)
  if (tags.length) lines.push(`**标签**：${tags.join(' ')}`)

  if (url) lines.push(`[查看原岗位](${url})`)
  if (detailUrl) lines.push(`[查看站内详情](${detailUrl})`)

  return lines.join('\n')
}
