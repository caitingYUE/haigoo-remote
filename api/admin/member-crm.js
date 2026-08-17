import path from 'path'
import { z } from 'zod'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { fileTypeFromBuffer } from 'file-type'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

const CLUB_TYPES = ['starter', 'half_year', 'annual']
const LEGACY_TYPES = ['trial_week', 'quarter', 'quarter_pro', 'year']
const ALL_CRM_TYPES = [...CLUB_TYPES, ...LEGACY_TYPES]
const APPLICATION_TYPES = ['apply', 'apply_redirect', 'pending_apply', 'email', 'referral']
const APPLICATION_STATUSES = [
  'entry_opened', 'pending', 'pending_apply', 'applied', 'reviewed', 'referred',
  'interviewing', 'offer', 'success', 'rejected', 'failed', 'withdrawn', 'closed'
]
const SERVICE_FLOW = [
  ['resume_diagnosis', '简历诊断和评估方案'],
  ['job_recommendation', '岗位推荐与准备材料'],
  ['custom_resume', '定制简历优化'],
  ['consultation', '一对一语音咨询'],
  ['application_followup', '申请跟进'],
  ['supplemental', '其他补充服务']
]
const SERVICE_FLOW_TYPES = SERVICE_FLOW.map(([key]) => key)
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const userIdSchema = z.string().trim().min(1).max(255)
const FILE_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain'
}

const nullableDate = z.union([z.string().datetime(), z.literal(''), z.null()]).optional()
const profileSchema = z.object({
  userId: userIdSchema,
  backgroundSummary: z.string().max(5000).default(''),
  detailedBackground: z.string().max(20000).default(''),
  primaryNeeds: z.string().max(10000).default(''),
  painPoints: z.string().max(10000).default(''),
  servicePlan: z.string().max(20000).default(''),
  serviceStage: z.enum(['not_started', 'onboarding', 'in_service', 'follow_up', 'paused', 'completed']).default('not_started'),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  lastContactAt: nullableDate,
  nextFollowUpAt: nullableDate
})
const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  userId: userIdSchema,
  entitlementKey: z.string().max(100).nullable().optional(),
  serviceType: z.string().trim().min(1).max(80).default('other'),
  title: z.string().trim().min(1).max(200),
  status: z.enum(['planned', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  scheduledAt: nullableDate,
  completedAt: nullableDate,
  details: z.string().max(10000).default(''),
  outcome: z.string().max(10000).default('')
})
const manualApplicationSchema = z.object({
  id: z.string().uuid().optional(),
  userId: userIdSchema,
  jobTitle: z.string().trim().min(1).max(300),
  companyName: z.string().trim().min(1).max(300),
  jobUrl: z.string().trim().max(2000).default('').refine((value) => !value || /^https?:\/\//i.test(value), '岗位链接必须以 http:// 或 https:// 开头'),
  applicationChannel: z.string().trim().min(1).max(80).default('external'),
  appliedAt: nullableDate,
  status: z.enum(APPLICATION_STATUSES).default('pending_apply'),
  notes: z.string().max(5000).default('')
})
const applicationEventSchema = z.object({
  userId: userIdSchema,
  sourceKind: z.enum(['site', 'manual']),
  applicationId: z.string().min(1),
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().max(5000).default(''),
  eventAt: nullableDate,
  nextFollowUpAt: nullableDate
})

function isLocalDevRuntime() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'
}

function isAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  return Boolean(user?.roles?.admin || user?.roles?.super_admin || SUPER_ADMIN_EMAILS.includes(email) || (isLocalDevRuntime() && email === 'test_admin@haigoo.com'))
}

function isSuperAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  return Boolean(user?.roles?.super_admin || SUPER_ADMIN_EMAILS.includes(email) || (isLocalDevRuntime() && email === 'test_admin@haigoo.com'))
}

async function requireAdmin(req, res, { write = false } = {}) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const user = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  if (!isAdminUser(user)) {
    res.status(403).json({ success: false, error: '无权访问会员 CRM' })
    return null
  }
  if (write && !isSuperAdminUser(user)) {
    res.status(403).json({ success: false, error: '仅超级管理员可修改会员 CRM' })
    return null
  }
  return { user, canEdit: isSuperAdminUser(user) }
}

function toNullableDate(value) {
  return value ? value : null
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

export function deriveMembershipState(row, now = new Date()) {
  const start = row.member_cycle_start_at ? new Date(row.member_cycle_start_at) : null
  const expire = row.member_expire_at ? new Date(row.member_expire_at) : null
  const invalidStart = start && Number.isNaN(start.getTime())
  const invalidExpire = expire && Number.isNaN(expire.getTime())
  if (invalidStart || invalidExpire || (start && expire && start >= expire)) return 'anomaly'
  if (row.member_status === 'expired' || (expire && expire <= now)) return 'expired'
  if (row.member_status === 'active' && start && start > now) return 'pending'
  if (row.member_status === 'active') {
    if (expire && expire.getTime() - now.getTime() <= 30 * 86400000) return 'expiring'
    return 'active'
  }
  return 'anomaly'
}

export function buildAttentionReasons(item) {
  const reasons = []
  if (item.membershipState === 'anomaly') reasons.push('会员日期异常')
  if (!item.hasServicePlan) reasons.push('缺少服务方案')
  if (item.nextFollowUpAt && new Date(item.nextFollowUpAt) < new Date()) reasons.push('跟进已逾期')
  if (item.unavailableRecommendationCount > 0) reasons.push(`${item.unavailableRecommendationCount} 个推荐岗位失效`)
  return reasons
}

export function isConfirmedApplication(application) {
  const status = application.status || application.current_status || 'applied'
  return !['entry_opened', 'pending', 'pending_apply'].includes(status)
}

function mapListRow(row) {
  const membershipState = deriveMembershipState(row)
  const latestByType = new Map(parseJson(row.service_flow_snapshot, []).map((item) => [item.serviceType, item]))
  const serviceFlow = SERVICE_FLOW.map(([key, label]) => {
    const record = latestByType.get(key) || {}
    return { key, label, status: record.status || 'not_started', completed: Boolean(record.completed), title: record.title || '', updatedAt: record.updatedAt || null }
  })
  const completedFlowCount = serviceFlow.filter((item) => item.completed).length
  const currentFlow = serviceFlow.find((item) => ['planned', 'scheduled', 'in_progress'].includes(item.status)) || null
  const currentIndex = currentFlow ? serviceFlow.indexOf(currentFlow) : -1
  const nextFlow = (currentIndex >= 0
    ? serviceFlow.slice(currentIndex + 1).find((item) => !item.completed)
    : serviceFlow.find((item) => !item.completed)) || null
  const item = {
    userId: String(row.user_id),
    email: row.email || '',
    username: row.username || '',
    fullName: row.full_name || '',
    memberDisplayId: row.member_display_id === null ? null : toNumber(row.member_display_id),
    memberType: row.member_type,
    memberStatus: row.member_status || '',
    membershipState,
    memberCycleStartAt: row.member_cycle_start_at || null,
    memberExpireAt: row.member_expire_at || null,
    serviceStage: row.service_stage || 'not_started',
    lastContactAt: row.last_contact_at || null,
    nextFollowUpAt: row.next_follow_up_at || null,
    applicationCount: toNumber(row.application_count),
    activeRecommendationCount: toNumber(row.active_recommendation_count),
    unavailableRecommendationCount: toNumber(row.unavailable_recommendation_count),
    pendingServiceCount: toNumber(row.pending_service_count),
    serviceFlow,
    completedFlowCount,
    currentServiceLabel: currentFlow?.label || (completedFlowCount === SERVICE_FLOW.length ? '全部完成' : ''),
    nextServiceLabel: nextFlow?.label || '',
    crmExcluded: Boolean(row.crm_excluded),
    crmExcludedAt: row.crm_excluded_at || null,
    crmExclusionReason: row.crm_exclusion_reason || '',
    hasServicePlan: Boolean(String(row.service_plan || '').trim())
  }
  return { ...item, attentionReasons: buildAttentionReasons(item) }
}

async function writeAudit({ targetUserId, adminUserId, action, entityType, entityId = null, changedFields = [], metadata = {} }) {
  await neonHelper.query(
    `INSERT INTO member_crm_audit_log
       (target_user_id, admin_user_id, action, entity_type, entity_id, changed_fields, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [targetUserId, adminUserId, action, entityType, entityId, JSON.stringify(changedFields), JSON.stringify(metadata)]
  )
}

async function isCrmMember(userId) {
  const rows = await neonHelper.query(
    'SELECT user_id FROM users WHERE user_id=$1 AND member_type=ANY($2) LIMIT 1',
    [userId, ALL_CRM_TYPES]
  )
  return Boolean(rows?.[0])
}

async function listMembers(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.pageSize, 10) || 25))
  const offset = (page - 1) * pageSize
  const includeLegacy = String(req.query.includeLegacy || '') === 'true'
  const memberType = String(req.query.memberType || 'all')
  const membershipState = String(req.query.membershipState || 'all')
  const serviceStage = String(req.query.serviceStage || 'all')
  const attention = String(req.query.attention || 'all')
  const visibility = ['active', 'excluded', 'all'].includes(String(req.query.visibility)) ? String(req.query.visibility) : 'active'
  const search = String(req.query.search || '').trim().toLowerCase()
  const allowedTypes = includeLegacy ? ALL_CRM_TYPES : CLUB_TYPES

  const params = [allowedTypes]
  const where = ['member_type = ANY($1)']
  if (visibility === 'active') where.push('crm_excluded = FALSE')
  if (visibility === 'excluded') where.push('crm_excluded = TRUE')
  if (memberType !== 'all' && ALL_CRM_TYPES.includes(memberType)) {
    params.push(memberType); where.push(`member_type = $${params.length}`)
  }
  if (membershipState !== 'all') {
    params.push(membershipState); where.push(`membership_state = $${params.length}`)
  }
  if (serviceStage !== 'all') {
    params.push(serviceStage); where.push(`service_stage = $${params.length}`)
  }
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`)
    where.push(`(LOWER(email) LIKE $${params.length} ESCAPE '\\' OR LOWER(username) LIKE $${params.length} ESCAPE '\\' OR LOWER(full_name) LIKE $${params.length} ESCAPE '\\' OR COALESCE(member_display_id::text, '') LIKE $${params.length})`)
  }
  if (attention === 'follow_up') where.push(`next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW()`)
  if (attention === 'job_unavailable') where.push(`unavailable_recommendation_count > 0`)
  if (attention === 'missing_plan') where.push(`COALESCE(NULLIF(TRIM(service_plan), ''), '') = ''`)

  const baseCte = `
    WITH base AS (
      SELECT
        u.user_id, u.email, u.username, u.member_display_id, u.member_type,
        u.member_status, u.member_cycle_start_at, u.member_expire_at,
        COALESCE(u.profile->>'fullName', '') AS full_name,
        COALESCE(crm.service_stage, 'not_started') AS service_stage,
        crm.last_contact_at, crm.next_follow_up_at, COALESCE(crm.service_plan, '') AS service_plan,
        (excluded.user_id IS NOT NULL) AS crm_excluded, excluded.excluded_at AS crm_excluded_at,
        COALESCE(excluded.reason, '') AS crm_exclusion_reason,
        CASE
          WHEN u.member_cycle_start_at IS NOT NULL AND u.member_expire_at IS NOT NULL AND u.member_cycle_start_at >= u.member_expire_at THEN 'anomaly'
          WHEN u.member_status = 'expired' OR (u.member_expire_at IS NOT NULL AND u.member_expire_at <= NOW()) THEN 'expired'
          WHEN u.member_status = 'active' AND u.member_cycle_start_at IS NOT NULL AND u.member_cycle_start_at > NOW() THEN 'pending'
          WHEN u.member_status = 'active' AND u.member_expire_at IS NOT NULL AND u.member_expire_at <= NOW() + INTERVAL '30 days' THEN 'expiring'
          WHEN u.member_status = 'active' THEN 'active'
          ELSE 'anomaly'
        END AS membership_state,
        (COALESCE(app.application_count, 0) + COALESCE(manual_app.application_count, 0))::int AS application_count,
        COALESCE(rec.active_count, 0)::int AS active_recommendation_count,
        COALESCE(rec.unavailable_count, 0)::int AS unavailable_recommendation_count,
        COALESCE(service.pending_count, 0)::int AS pending_service_count
        , COALESCE(service.flow_snapshot, '[]'::jsonb) AS service_flow_snapshot
      FROM users u
      LEFT JOIN member_crm_profiles crm ON crm.user_id = u.user_id
      LEFT JOIN member_crm_exclusions excluded ON excluded.user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS application_count
        FROM user_job_interactions i
        WHERE i.user_id = u.user_id AND i.interaction_type = ANY($2)
          AND COALESCE(i.status, 'applied') NOT IN ('entry_opened', 'pending', 'pending_apply')
      ) app ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS application_count
        FROM member_crm_manual_applications manual
        WHERE manual.user_id = u.user_id AND manual.archived_at IS NULL
          AND manual.current_status NOT IN ('entry_opened', 'pending', 'pending_apply')
      ) manual_app ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT ids.job_id) FILTER (WHERE j.job_id IS NOT NULL AND j.status = 'active' AND j.is_approved = TRUE)::int AS active_count,
               COUNT(DISTINCT ids.job_id) FILTER (WHERE j.job_id IS NULL OR j.status <> 'active' OR j.is_approved IS NOT TRUE)::int AS unavailable_count
        FROM job_bundles b
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.job_ids, '[]'::jsonb)) ids(job_id)
        LEFT JOIN jobs j ON j.job_id = ids.job_id
        WHERE b.visibility = 'specified'
          AND (COALESCE(b.allowed_user_ids, '[]'::jsonb) ? u.user_id::text OR COALESCE(b.allowed_emails, '[]'::jsonb) ? LOWER(u.email))
      ) rec ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (SELECT COUNT(*)::int FROM member_crm_service_records pending
            WHERE pending.user_id = u.user_id AND pending.archived_at IS NULL
              AND pending.status NOT IN ('completed', 'cancelled')) AS pending_count,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'serviceType', latest.service_type, 'title', latest.title,
              'status', latest.status, 'completed', latest.completed, 'updatedAt', latest.updated_at
            ) ORDER BY latest.updated_at DESC), '[]'::jsonb)
            FROM (
              SELECT record.service_type,
                (array_agg(record.title ORDER BY
                  CASE WHEN record.status IN ('in_progress','scheduled','planned') THEN 0
                       WHEN record.status='completed' THEN 1 ELSE 2 END,
                  record.updated_at DESC))[1] AS title,
                (array_agg(record.status ORDER BY
                  CASE WHEN record.status IN ('in_progress','scheduled','planned') THEN 0
                       WHEN record.status='completed' THEN 1 ELSE 2 END,
                  record.updated_at DESC))[1] AS status,
                BOOL_OR(record.status='completed') AS completed,
                (array_agg(record.updated_at ORDER BY
                  CASE WHEN record.status IN ('in_progress','scheduled','planned') THEN 0
                       WHEN record.status='completed' THEN 1 ELSE 2 END,
                  record.updated_at DESC))[1] AS updated_at
              FROM member_crm_service_records record
              WHERE record.user_id = u.user_id AND record.archived_at IS NULL
                AND record.service_type = ANY($3)
              GROUP BY record.service_type
            ) latest) AS flow_snapshot
      ) service ON TRUE
    )`

  const baseParams = [allowedTypes, APPLICATION_TYPES, SERVICE_FLOW_TYPES]
  const dynamicParams = params.slice(1)
  const remappedWhere = where.map((clause) => clause.replace(/\$(\d+)/g, (_, raw) => {
    const n = Number(raw)
    return n === 1 ? '$1' : `$${n + 2}`
  }))
  const allParams = [...baseParams, ...dynamicParams]
  const whereSql = remappedWhere.join(' AND ')
  const limitParam = allParams.length + 1
  const offsetParam = allParams.length + 2

  const [rows, countRows, summaryRows] = await Promise.all([
    neonHelper.query(`${baseCte} SELECT * FROM base WHERE ${whereSql} ORDER BY
      CASE WHEN next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW() THEN 0 ELSE 1 END,
      member_expire_at ASC NULLS LAST, username ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}`, [...allParams, pageSize, offset]),
    neonHelper.query(`${baseCte} SELECT COUNT(*)::int AS total FROM base WHERE ${whereSql}`, allParams),
    neonHelper.query(`${baseCte} SELECT
      COUNT(*) FILTER (WHERE member_type = ANY($1) AND membership_state IN ('active','expiring'))::int AS active,
      COUNT(*) FILTER (WHERE member_type = ANY($1) AND membership_state = 'expiring')::int AS expiring,
      COUNT(*) FILTER (WHERE member_type = ANY($1) AND next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW())::int AS follow_up_due,
      COUNT(*) FILTER (WHERE member_type = ANY($1) AND unavailable_recommendation_count > 0)::int AS recommendation_attention
      FROM base WHERE crm_excluded = FALSE`, [CLUB_TYPES, APPLICATION_TYPES, SERVICE_FLOW_TYPES])
  ])
  const total = toNumber(countRows?.[0]?.total)
  const summary = summaryRows?.[0] || {}
  return {
    items: (rows || []).map(mapListRow),
    summary: {
      active: toNumber(summary.active), expiring: toNumber(summary.expiring),
      followUpDue: toNumber(summary.follow_up_due), recommendationAttention: toNumber(summary.recommendation_attention)
    },
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  }
}

async function getMemberDetail(userId, canEdit) {
  const userRows = await neonHelper.query(`
    SELECT u.user_id, u.email, u.username, u.avatar, u.member_display_id, u.member_type,
           u.member_status, u.member_cycle_start_at, u.member_expire_at, u.profile,
           COALESCE(crm.background_summary, '') AS background_summary,
           COALESCE(crm.detailed_background, '') AS detailed_background,
           COALESCE(crm.primary_needs, '') AS primary_needs,
           COALESCE(crm.pain_points, '') AS pain_points,
           COALESCE(crm.service_plan, '') AS service_plan,
           COALESCE(crm.service_stage, 'not_started') AS service_stage,
           COALESCE(crm.tags, '[]'::jsonb) AS crm_tags,
           crm.last_contact_at, crm.next_follow_up_at, crm.updated_at AS crm_updated_at
      FROM users u
      LEFT JOIN member_crm_profiles crm ON crm.user_id = u.user_id
     WHERE u.user_id = $1 AND u.member_type = ANY($2)
     LIMIT 1`, [userId, ALL_CRM_TYPES])
  const row = userRows?.[0]
  if (!row) return null

  const [serviceRows, entitlementRows, userResumeRows, crmResumeRows, siteRows, manualRows, eventRows, bundleRows, auditRows] = await Promise.all([
    neonHelper.query(`SELECT s.*, COALESCE(admin.username, admin.email, '') AS created_by_name,
      COALESCE(documents.items, '[]'::jsonb) AS documents
      FROM member_crm_service_records s LEFT JOIN users admin ON admin.user_id = s.created_by
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', d.id, 'fileName', d.file_name, 'fileType', d.file_type,
          'fileSize', d.file_size, 'notes', d.notes, 'createdAt', d.created_at
        ) ORDER BY d.created_at DESC) AS items
        FROM member_crm_service_documents d WHERE d.service_record_id=s.id
      ) documents ON TRUE
      WHERE s.user_id = $1 AND s.archived_at IS NULL ORDER BY COALESCE(s.completed_at, s.scheduled_at, s.created_at) DESC`, [userId]),
    neonHelper.query(`SELECT d.entitlement_key, d.name, d.description, d.default_status, d.default_total_quota,
      e.status, e.total_quota, e.used_quota, e.remaining_quota, e.expires_at, e.metadata, e.notes
      FROM member_service_entitlement_definitions d
      LEFT JOIN user_member_service_entitlements e ON e.entitlement_key = d.entitlement_key AND e.user_id = $1
      WHERE d.enabled = TRUE AND $2 = ANY(d.applicable_member_types) ORDER BY d.sort_order`, [userId, row.member_type]),
    neonHelper.query(`SELECT resume_id, file_name, file_size, file_type, parse_status, created_at
      FROM resumes WHERE user_id = $1 ORDER BY created_at DESC`, [userId]),
    neonHelper.query(`SELECT id, file_name, file_size, file_type, parse_status, notes, created_at
      FROM member_crm_resume_documents WHERE user_id = $1 ORDER BY created_at DESC`, [userId]),
    neonHelper.query(`SELECT i.id, i.job_id, i.interaction_type, i.application_source, i.status, i.notes, i.created_at, i.updated_at,
      COALESCE(j.title, i.job_title_snapshot, '职位已删除') AS job_title,
      COALESCE(j.company, i.company_name_snapshot, '未知企业') AS company_name,
      j.job_id AS live_job_id, j.status AS live_job_status, j.is_approved
      FROM user_job_interactions i LEFT JOIN jobs j ON j.job_id = i.job_id
      WHERE i.user_id = $1 AND i.interaction_type = ANY($2) ORDER BY i.updated_at DESC`, [userId, APPLICATION_TYPES]),
    neonHelper.query(`SELECT * FROM member_crm_manual_applications WHERE user_id = $1 AND archived_at IS NULL ORDER BY updated_at DESC`, [userId]),
    neonHelper.query(`SELECT e.*, COALESCE(admin.username, admin.email, '') AS created_by_name
      FROM member_crm_application_events e LEFT JOIN users admin ON admin.user_id = e.created_by
      WHERE e.user_id = $1 ORDER BY e.event_at DESC`, [userId]),
    neonHelper.query(`SELECT b.id, b.title, b.is_active, b.start_time, b.end_time, ids.job_id,
      COALESCE(j.title, (b.job_snapshots -> ids.job_id) ->> 'title', '职位已删除') AS job_title,
      COALESCE(j.company, (b.job_snapshots -> ids.job_id) ->> 'company', '未知企业') AS company_name,
      j.job_id AS live_job_id, j.status AS live_job_status, j.is_approved
      FROM job_bundles b
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.job_ids, '[]'::jsonb)) ids(job_id)
      LEFT JOIN jobs j ON j.job_id = ids.job_id
      WHERE b.visibility = 'specified'
        AND (COALESCE(b.allowed_user_ids, '[]'::jsonb) ? $1::text OR COALESCE(b.allowed_emails, '[]'::jsonb) ? LOWER($2::text))
      ORDER BY b.created_at DESC`, [userId, row.email]),
    neonHelper.query(`SELECT a.*, COALESCE(admin.username, admin.email, '系统') AS admin_name
      FROM member_crm_audit_log a LEFT JOIN users admin ON admin.user_id = a.admin_user_id
      WHERE a.target_user_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [userId])
  ])

  const profile = parseJson(row.profile, {})
  const listBase = mapListRow({
    ...row,
    full_name: profile.fullName || '',
    application_count:
      (siteRows || []).filter(isConfirmedApplication).length
      + (manualRows || []).filter(isConfirmedApplication).length,
    active_recommendation_count: (bundleRows || []).filter((job) => job.live_job_id && job.live_job_status === 'active' && job.is_approved === true).length,
    unavailable_recommendation_count: (bundleRows || []).filter((job) => !job.live_job_id || job.live_job_status !== 'active' || job.is_approved !== true).length,
    pending_service_count: (serviceRows || []).filter((service) => !['completed', 'cancelled'].includes(service.status)).length
  })

  const eventsBySite = new Map()
  const eventsByManual = new Map()
  for (const event of eventRows || []) {
    const target = event.site_interaction_id ? eventsBySite : eventsByManual
    const key = String(event.site_interaction_id || event.manual_application_id)
    if (!target.has(key)) target.set(key, [])
    target.get(key).push({
      id: event.id, status: event.status, note: event.note || '', eventAt: event.event_at,
      nextFollowUpAt: event.next_follow_up_at || null, createdByName: event.created_by_name || ''
    })
  }
  const applications = [
    ...(siteRows || []).map((app) => {
      const events = eventsBySite.get(String(app.id)) || []
      return {
        id: String(app.id), sourceKind: 'site', sourceInteractionId: Number(app.id), jobId: app.job_id,
        jobTitle: app.job_title, companyName: app.company_name, jobUrl: app.job_id ? `/job/${encodeURIComponent(app.job_id)}` : '',
        applicationChannel: app.application_source || app.interaction_type, status: events[0]?.status || app.status || 'pending_apply',
        appliedAt: app.created_at || null, updatedAt: events[0]?.eventAt || app.updated_at || null, notes: app.notes || '',
        jobAvailability: !app.live_job_id ? 'deleted' : app.live_job_status === 'active' && app.is_approved === true ? 'active' : 'unavailable', events
      }
    }),
    ...(manualRows || []).map((app) => {
      const events = eventsByManual.get(String(app.id)) || []
      return {
        id: app.id, sourceKind: 'manual', sourceInteractionId: null, jobId: null,
        jobTitle: app.job_title, companyName: app.company_name, jobUrl: app.job_url || '',
        applicationChannel: app.application_channel, status: events[0]?.status || app.current_status,
        appliedAt: app.applied_at || null, updatedAt: events[0]?.eventAt || app.updated_at, notes: app.notes || '',
        jobAvailability: 'external', events
      }
    })
  ].sort((a, b) => new Date(b.updatedAt || b.appliedAt || 0).getTime() - new Date(a.updatedAt || a.appliedAt || 0).getTime())

  const bundleMap = new Map()
  for (const job of bundleRows || []) {
    if (!bundleMap.has(job.id)) {
      const now = new Date()
      bundleMap.set(job.id, {
        id: Number(job.id), title: job.title || '', isActive: Boolean(job.is_active),
        scheduleState: job.start_time && new Date(job.start_time) > now ? 'upcoming' : job.end_time && new Date(job.end_time) < now ? 'expired' : 'active',
        startTime: job.start_time || null, endTime: job.end_time || null, jobs: []
      })
    }
    bundleMap.get(job.id).jobs.push({
      jobId: job.job_id, title: job.job_title, company: job.company_name,
      status: !job.live_job_id ? 'deleted' : job.live_job_status === 'active' && job.is_approved === true ? 'active' : 'unavailable'
    })
  }

  return {
    member: {
      ...listBase,
      avatar: row.avatar || '', title: profile.title || '', location: profile.location || '',
      targetRole: profile.targetRole || '', bio: profile.bio || '', phone: profile.phone || '',
      website: profile.website || '', linkedin: profile.linkedin || '', github: profile.github || '',
      summary: profile.summary || '', experience: Array.isArray(profile.experience) ? profile.experience : [],
      education: Array.isArray(profile.education) ? profile.education : [], skills: Array.isArray(profile.skills) ? profile.skills : []
    },
    crmProfile: {
      backgroundSummary: row.background_summary, detailedBackground: row.detailed_background,
      primaryNeeds: row.primary_needs, painPoints: row.pain_points, servicePlan: row.service_plan,
      serviceStage: row.service_stage, tags: parseJson(row.crm_tags, []), lastContactAt: row.last_contact_at || null,
      nextFollowUpAt: row.next_follow_up_at || null, updatedAt: row.crm_updated_at || null
    },
    entitlements: (entitlementRows || []).map((item) => ({
      key: item.entitlement_key, name: item.name, description: item.description || '', status: item.status || item.default_status,
      totalQuota: item.total_quota ?? item.default_total_quota ?? null, usedQuota: toNumber(item.used_quota),
      remainingQuota: item.remaining_quota ?? item.default_total_quota ?? null, expiresAt: item.expires_at || null,
      appointmentAt: parseJson(item.metadata, {}).appointmentAt || null, completedAt: parseJson(item.metadata, {}).completedAt || null,
      note: item.notes || ''
    })),
    services: (serviceRows || []).map((item) => ({
      id: item.id, userId: item.user_id, entitlementKey: item.entitlement_key || null, serviceType: item.service_type,
      title: item.title, status: item.status, scheduledAt: item.scheduled_at || null, completedAt: item.completed_at || null,
      details: item.details || '', outcome: item.outcome || '', createdAt: item.created_at, updatedAt: item.updated_at,
      createdByName: item.created_by_name || '', documents: parseJson(item.documents, [])
    })),
    applications,
    userResumes: (userResumeRows || []).map((item) => ({
      id: item.resume_id, source: 'user', fileName: item.file_name, fileType: item.file_type,
      fileSize: toNumber(item.file_size), parseStatus: item.parse_status || '', createdAt: item.created_at
    })),
    crmResumes: (crmResumeRows || []).map((item) => ({
      id: item.id, source: 'crm', fileName: item.file_name, fileType: item.file_type,
      fileSize: toNumber(item.file_size), parseStatus: item.parse_status || '',
      notes: item.notes || '', createdAt: item.created_at
    })),
    recommendationBundles: [...bundleMap.values()],
    auditLog: (auditRows || []).map((item) => ({
      id: Number(item.id), action: item.action, entityType: item.entity_type, entityId: item.entity_id || null,
      changedFields: parseJson(item.changed_fields, []), metadata: parseJson(item.metadata, {}),
      createdAt: item.created_at, adminName: item.admin_name || '系统'
    })),
    canEdit
  }
}

export function sanitizeDbText(value) {
  return String(value || '').split(String.fromCharCode(0)).join('').trim()
}

export function encodeDbFile(buffer) {
  return Buffer.from(buffer || []).toString('base64')
}

function decodeDbFile(value) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  const text = String(value || '')
  if (text.startsWith('\\x')) return Buffer.from(text.slice(2), 'hex')
  return Buffer.from(text, 'base64')
}

async function parseMultipart(req, entityLabel = '文件') {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_UPLOAD_BYTES + 1024 * 128) return reject(new Error(`${entityLabel}不能超过 10MB`))
      chunks.push(chunk)
    })
    req.on('error', reject)
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const boundaryValue = String(req.headers['content-type'] || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i)
        const boundary = boundaryValue?.[1] || boundaryValue?.[2]
        if (!boundary) throw new Error('上传格式无效')
        const parts = buffer.toString('binary').split(`--${boundary}`)
        const fields = {}
        let file = null
        for (const raw of parts) {
          const splitAt = raw.indexOf('\r\n\r\n')
          if (splitAt < 0) continue
          const header = raw.slice(0, splitAt)
          let body = raw.slice(splitAt + 4)
          if (body.endsWith('\r\n')) body = body.slice(0, -2)
          const name = header.match(/name="([^"]+)"/)?.[1]
          if (!name) continue
          const rawFileName = header.match(/filename="([^"]*)"/)?.[1]
          const encodedFileName = header.match(/filename\*=UTF-8''([^;\r\n]+)/i)?.[1]
          if (rawFileName !== undefined || encodedFileName !== undefined) {
            let decodedFileName = ''
            try {
              decodedFileName = encodedFileName ? decodeURIComponent(encodedFileName) : Buffer.from(rawFileName || '', 'binary').toString('utf8')
            } catch { decodedFileName = rawFileName || '' }
            file = { fileName: path.basename(sanitizeDbText(decodedFileName)), buffer: Buffer.from(body, 'binary') }
          } else {
            fields[name] = sanitizeDbText(Buffer.from(body, 'binary').toString('utf8'))
          }
        }
        if (!file?.buffer?.length) throw new Error(`请选择${entityLabel}`)
        resolve({ ...file, fields })
      } catch (error) { reject(error) }
    })
  })
}

async function extractResumeText(buffer, extension) {
  try {
    if (extension === 'txt') return { status: 'success', text: sanitizeDbText(buffer.toString('utf8')) }
    if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer })
      const text = sanitizeDbText(result.value)
      return { status: text ? 'success' : 'partial', text }
    }
    if (extension === 'pdf') {
      const result = await pdfParse(buffer)
      const text = sanitizeDbText(result.text)
      return { status: text ? 'success' : 'partial', text }
    }
  } catch (error) {
    console.warn('[member-crm] Resume parse failed:', error.message)
  }
  return { status: 'failed', text: '' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })

  const resource = String(req.query?.resource || 'members')
  const fileReadResources = ['resume-file', 'service-document-file']
  const isWrite = req.method !== 'GET' || fileReadResources.includes(resource)
  const auth = await requireAdmin(req, res, { write: isWrite && !fileReadResources.includes(resource) })
  if (!auth) return
  const adminId = auth.user.user_id || auth.user.userId

  try {
    if (isWrite && !fileReadResources.includes(resource) && resource !== 'consultations') {
      const queryUserResources = ['resumes', 'service-documents']
      const targetUserId = userIdSchema.parse(req.method === 'DELETE' || queryUserResources.includes(resource)
        ? req.query?.userId
        : req.body?.userId)
      if (!(await isCrmMember(targetUserId))) {
        return res.status(404).json({ success: false, error: '会员不存在或不在 CRM 范围内' })
      }
    }
    if (req.method === 'GET' && resource === 'members') {
      return res.status(200).json({ success: true, data: { ...(await listMembers(req)), canEdit: auth.canEdit } })
    }
    if (req.method === 'GET' && resource === 'consultations') {
      const status = ['pending', 'contacted', 'scheduled', 'completed', 'closed'].includes(String(req.query.status))
        ? String(req.query.status)
        : 'all'
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
      const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.pageSize, 10) || 25))
      const offset = (page - 1) * pageSize
      const search = String(req.query.search || '').trim()
      const params = []
      const where = []
      if (status !== 'all') { params.push(status); where.push(`request.status = $${params.length}`) }
      if (search) {
        params.push(`%${search.replace(/[\%_]/g, '\$&')}%`)
        where.push(`(LOWER(COALESCE(users.email, '')) LIKE LOWER($${params.length}) ESCAPE '\\' OR LOWER(COALESCE(users.username, '')) LIKE LOWER($${params.length}) ESCAPE '\\' OR LOWER(request.wechat_id) LIKE LOWER($${params.length}) ESCAPE '\\')`)
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const [rows, countRows, summaryRows] = await Promise.all([
        neonHelper.query(
          `SELECT request.id, request.user_id, request.consultation_topic, request.wechat_id,
                  request.question, request.source_page, request.source_content_id,
                  request.source_company_id, request.status, request.assigned_to,
                  request.created_at, request.updated_at, request.contacted_at, request.closed_at,
                  users.email, users.username, users.member_type,
                  COALESCE(owner.username, owner.email, '') AS assigned_to_name
             FROM member_crm_consultation_requests request
             JOIN users ON users.user_id = request.user_id
             LEFT JOIN users owner ON owner.user_id = request.assigned_to
             ${whereSql}
            ORDER BY CASE request.status WHEN 'pending' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END,
                     request.created_at ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, offset]
        ),
        neonHelper.query(
          `SELECT COUNT(*)::int AS total
             FROM member_crm_consultation_requests request
             JOIN users ON users.user_id = request.user_id ${whereSql}`,
          params
        ),
        neonHelper.query(
          `SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending,
                  COUNT(*) FILTER (WHERE status='contacted')::int AS contacted,
                  COUNT(*) FILTER (WHERE status IN ('scheduled','completed'))::int AS active
             FROM member_crm_consultation_requests`
        )
      ])
      const total = toNumber(countRows?.[0]?.total)
      return res.status(200).json({ success: true, data: {
        items: (rows || []).map((item) => ({
          id: item.id, userId: item.user_id, topic: item.consultation_topic,
          wechatId: item.wechat_id, question: item.question || '', sourcePage: item.source_page,
          sourceContentId: item.source_content_id || null, sourceCompanyId: item.source_company_id || null,
          status: item.status, assignedTo: item.assigned_to || null, assignedToName: item.assigned_to_name || '',
          createdAt: item.created_at, updatedAt: item.updated_at, contactedAt: item.contacted_at || null,
          closedAt: item.closed_at || null, email: item.email || '', username: item.username || '',
          memberType: item.member_type || 'none'
        })),
        summary: {
          pending: toNumber(summaryRows?.[0]?.pending),
          contacted: toNumber(summaryRows?.[0]?.contacted),
          active: toNumber(summaryRows?.[0]?.active)
        },
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        canEdit: auth.canEdit
      } })
    }
    if (req.method === 'PATCH' && resource === 'consultations') {
      const input = z.object({
        id: z.string().uuid(),
        status: z.enum(['pending', 'contacted', 'scheduled', 'completed', 'closed'])
      }).parse(req.body || {})
      const rows = await neonHelper.query(
        `UPDATE member_crm_consultation_requests
            SET status=$2, assigned_to=COALESCE(assigned_to,$3), updated_at=NOW(),
                contacted_at=CASE WHEN $2 IN ('contacted','scheduled','completed') THEN COALESCE(contacted_at,NOW()) ELSE contacted_at END,
                closed_at=CASE WHEN $2='closed' THEN COALESCE(closed_at,NOW()) ELSE NULL END
          WHERE id=$1
          RETURNING id,user_id,status,updated_at`,
        [input.id, input.status, adminId]
      )
      const saved = rows?.[0]
      if (!saved) return res.status(404).json({ success: false, error: '咨询记录不存在' })
      await writeAudit({
        targetUserId: saved.user_id,
        adminUserId: adminId,
        action: 'consultation_status_updated',
        entityType: 'consultation_request',
        entityId: input.id,
        changedFields: ['status'],
        metadata: { status: input.status }
      })
      return res.status(200).json({ success: true, data: { id: saved.id, status: saved.status, updatedAt: saved.updated_at } })
    }
    if (req.method === 'GET' && resource === 'detail') {
      const userId = userIdSchema.parse(req.query.userId)
      const detail = await getMemberDetail(userId, auth.canEdit)
      if (!detail) return res.status(404).json({ success: false, error: '会员不存在或不在 CRM 范围内' })
      return res.status(200).json({ success: true, data: detail })
    }
    if (req.method === 'PATCH' && resource === 'member-visibility') {
      const input = z.object({
        userId: userIdSchema,
        action: z.enum(['exclude', 'restore']),
        reason: z.string().trim().max(500).optional().default('')
      }).parse(req.body || {})
      if (input.action === 'exclude') {
        await neonHelper.query(`WITH saved AS (
            INSERT INTO member_crm_exclusions (user_id,reason,excluded_by)
            VALUES ($1,$2,$3)
            ON CONFLICT (user_id) DO UPDATE SET reason=EXCLUDED.reason,
              excluded_by=EXCLUDED.excluded_by, excluded_at=NOW(), updated_at=NOW()
            RETURNING user_id
          ), audit_saved AS (
            INSERT INTO member_crm_audit_log
              (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
            SELECT $1,$3,'member_excluded_from_crm','member',$1,
              jsonb_build_object('reason',$2) FROM saved
          ) SELECT user_id FROM saved`, [input.userId, input.reason, adminId])
      } else {
        await neonHelper.query(`WITH saved AS (
            DELETE FROM member_crm_exclusions WHERE user_id=$1 RETURNING user_id
          ), audit_saved AS (
            INSERT INTO member_crm_audit_log
              (target_user_id,admin_user_id,action,entity_type,entity_id)
            SELECT $1,$2,'member_restored_to_crm','member',$1 FROM saved
          ) SELECT user_id FROM saved`, [input.userId, adminId])
      }
      return res.status(200).json({ success: true, data: { userId: input.userId, excluded: input.action === 'exclude' } })
    }
    if (req.method === 'PATCH' && resource === 'profile') {
      const input = profileSchema.parse(req.body || {})
      const fields = ['backgroundSummary', 'detailedBackground', 'primaryNeeds', 'painPoints', 'servicePlan', 'serviceStage', 'tags', 'lastContactAt', 'nextFollowUpAt']
      const rows = await neonHelper.query(`WITH saved AS (
          INSERT INTO member_crm_profiles
            (user_id, background_summary, detailed_background, primary_needs, pain_points, service_plan, service_stage, tags, last_contact_at, next_follow_up_at, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$11)
          ON CONFLICT (user_id) DO UPDATE SET background_summary=EXCLUDED.background_summary,
            detailed_background=EXCLUDED.detailed_background, primary_needs=EXCLUDED.primary_needs,
            pain_points=EXCLUDED.pain_points, service_plan=EXCLUDED.service_plan, service_stage=EXCLUDED.service_stage,
            tags=EXCLUDED.tags, last_contact_at=EXCLUDED.last_contact_at, next_follow_up_at=EXCLUDED.next_follow_up_at,
            updated_by=EXCLUDED.updated_by, updated_at=NOW()
          RETURNING *
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,changed_fields)
          SELECT $1,$11,'profile_updated','profile',$12::jsonb FROM saved
        ) SELECT saved.* FROM saved`, [input.userId, input.backgroundSummary, input.detailedBackground, input.primaryNeeds, input.painPoints,
        input.servicePlan, input.serviceStage, JSON.stringify(input.tags), toNullableDate(input.lastContactAt), toNullableDate(input.nextFollowUpAt), adminId, JSON.stringify(fields)])
      const saved = rows[0]
      return res.status(200).json({ success: true, data: {
        backgroundSummary: saved.background_summary, detailedBackground: saved.detailed_background, primaryNeeds: saved.primary_needs,
        painPoints: saved.pain_points, servicePlan: saved.service_plan, serviceStage: saved.service_stage,
        tags: parseJson(saved.tags, []), lastContactAt: saved.last_contact_at || null, nextFollowUpAt: saved.next_follow_up_at || null, updatedAt: saved.updated_at
      } })
    }
    if (resource === 'services' && (req.method === 'POST' || req.method === 'PATCH')) {
      const input = serviceSchema.parse(req.body || {})
      let rows
      if (req.method === 'POST') {
        rows = await neonHelper.query(`WITH entitlement_before AS MATERIALIZED (
            SELECT to_jsonb(e) AS snapshot FROM user_member_service_entitlements e
            WHERE e.user_id=$1 AND e.entitlement_key=$2
          ), saved AS (
            INSERT INTO member_crm_service_records
              (user_id, entitlement_key, service_type, title, status, scheduled_at, completed_at, details, outcome, created_by, updated_by)
            VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5='completed' THEN COALESCE($7,NOW()) ELSE $7 END,$8,$9,$10,$10)
            RETURNING *
          ), entitlement_saved AS (
            INSERT INTO user_member_service_entitlements
              (user_id, entitlement_key, status, total_quota, used_quota, remaining_quota, metadata, notes, updated_by)
            SELECT saved.user_id, d.entitlement_key, 'completed', d.default_total_quota, 1,
              CASE WHEN d.default_total_quota IS NULL THEN NULL ELSE GREATEST(d.default_total_quota - 1, 0) END,
              jsonb_build_object('completedAt', saved.completed_at::text), saved.outcome, $10
            FROM saved
            JOIN member_service_entitlement_definitions d ON d.entitlement_key=saved.entitlement_key
            WHERE saved.status='completed'
            ON CONFLICT (user_id, entitlement_key) DO UPDATE SET status='completed',
              used_quota=CASE WHEN user_member_service_entitlements.total_quota IS NULL
                THEN user_member_service_entitlements.used_quota + 1
                ELSE LEAST(user_member_service_entitlements.used_quota + 1,user_member_service_entitlements.total_quota) END,
              remaining_quota=CASE WHEN user_member_service_entitlements.total_quota IS NULL THEN NULL
                ELSE GREATEST(user_member_service_entitlements.total_quota - user_member_service_entitlements.used_quota - 1, 0) END,
              metadata=user_member_service_entitlements.metadata || EXCLUDED.metadata,
              notes=EXCLUDED.notes, updated_by=$10, updated_at=NOW()
            RETURNING *
          ), entitlement_audit AS (
            INSERT INTO user_member_service_entitlement_audit
              (user_id, entitlement_key, admin_user_id, before_snapshot, after_snapshot, reason)
            SELECT entitlement_saved.user_id, entitlement_saved.entitlement_key, $10,
              COALESCE((SELECT snapshot FROM entitlement_before), 'null'::jsonb),
              to_jsonb(entitlement_saved), 'member_crm_service_completed'
            FROM entitlement_saved
            RETURNING id
          ), crm_audit AS (
            INSERT INTO member_crm_audit_log
              (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields)
            SELECT saved.user_id,$10,'service_created','service',saved.id,
              '["title","status","scheduledAt","completedAt","details","outcome"]'::jsonb FROM saved
            RETURNING id
          )
          SELECT saved.* FROM saved
          LEFT JOIN (SELECT COUNT(*) AS audit_count FROM entitlement_audit) audit_result ON TRUE
          LEFT JOIN (SELECT COUNT(*) AS crm_audit_count FROM crm_audit) crm_audit_result ON TRUE`,
          [input.userId, input.entitlementKey || null, input.serviceType, input.title, input.status,
            toNullableDate(input.scheduledAt), toNullableDate(input.completedAt), input.details, input.outcome, adminId])
      } else {
        rows = await neonHelper.query(`WITH existing AS MATERIALIZED (
            SELECT * FROM member_crm_service_records
            WHERE id=$10 AND user_id=$11 AND archived_at IS NULL FOR UPDATE
          ), entitlement_before AS MATERIALIZED (
            SELECT to_jsonb(e) AS snapshot FROM user_member_service_entitlements e
            WHERE e.user_id=$11 AND e.entitlement_key=$1
          ), saved AS (
            UPDATE member_crm_service_records target SET
              entitlement_key=CASE WHEN existing.status='completed' THEN existing.entitlement_key ELSE $1 END,
              service_type=$2, title=$3, status=$4, scheduled_at=$5,
              completed_at=CASE WHEN $4='completed' THEN COALESCE($6,target.completed_at,NOW()) ELSE $6 END,
              details=$7, outcome=$8, updated_by=$9, updated_at=NOW()
            FROM existing WHERE target.id=existing.id
            RETURNING target.*, existing.status AS previous_status
          ), entitlement_saved AS (
            INSERT INTO user_member_service_entitlements
              (user_id, entitlement_key, status, total_quota, used_quota, remaining_quota, metadata, notes, updated_by)
            SELECT saved.user_id, d.entitlement_key, 'completed', d.default_total_quota, 1,
              CASE WHEN d.default_total_quota IS NULL THEN NULL ELSE GREATEST(d.default_total_quota - 1, 0) END,
              jsonb_build_object('completedAt', saved.completed_at::text), saved.outcome, $9
            FROM saved
            JOIN member_service_entitlement_definitions d ON d.entitlement_key=saved.entitlement_key
            WHERE saved.status='completed' AND saved.previous_status IS DISTINCT FROM 'completed'
            ON CONFLICT (user_id, entitlement_key) DO UPDATE SET status='completed',
              used_quota=CASE WHEN user_member_service_entitlements.total_quota IS NULL
                THEN user_member_service_entitlements.used_quota + 1
                ELSE LEAST(user_member_service_entitlements.used_quota + 1,user_member_service_entitlements.total_quota) END,
              remaining_quota=CASE WHEN user_member_service_entitlements.total_quota IS NULL THEN NULL
                ELSE GREATEST(user_member_service_entitlements.total_quota - user_member_service_entitlements.used_quota - 1, 0) END,
              metadata=user_member_service_entitlements.metadata || EXCLUDED.metadata,
              notes=EXCLUDED.notes, updated_by=$9, updated_at=NOW()
            RETURNING *
          ), entitlement_audit AS (
            INSERT INTO user_member_service_entitlement_audit
              (user_id, entitlement_key, admin_user_id, before_snapshot, after_snapshot, reason)
            SELECT entitlement_saved.user_id, entitlement_saved.entitlement_key, $9,
              COALESCE((SELECT snapshot FROM entitlement_before), 'null'::jsonb),
              to_jsonb(entitlement_saved), 'member_crm_service_completed'
            FROM entitlement_saved
            RETURNING id
          ), crm_audit AS (
            INSERT INTO member_crm_audit_log
              (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields)
            SELECT saved.user_id,$9,'service_updated','service',saved.id,
              '["title","status","scheduledAt","completedAt","details","outcome"]'::jsonb FROM saved
            RETURNING id
          )
          SELECT saved.* FROM saved
          LEFT JOIN (SELECT COUNT(*) AS audit_count FROM entitlement_audit) audit_result ON TRUE
          LEFT JOIN (SELECT COUNT(*) AS crm_audit_count FROM crm_audit) crm_audit_result ON TRUE`,
          [input.entitlementKey || null, input.serviceType, input.title, input.status, toNullableDate(input.scheduledAt),
            toNullableDate(input.completedAt), input.details, input.outcome, adminId, input.id, input.userId])
      }
      const saved = rows?.[0]
      if (!saved) return res.status(404).json({ success: false, error: '服务记录不存在' })
      return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data: saved })
    }
    if (req.method === 'DELETE' && resource === 'services') {
      const userId = userIdSchema.parse(req.query.userId)
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query(`WITH saved AS (
          UPDATE member_crm_service_records SET archived_at=NOW(), updated_by=$1, updated_at=NOW()
          WHERE id=$2 AND user_id=$3 AND archived_at IS NULL RETURNING id
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log (target_user_id,admin_user_id,action,entity_type,entity_id)
          SELECT $3,$1,'service_archived','service',saved.id FROM saved
        ) SELECT saved.id FROM saved`, [adminId, id, userId])
      if (!rows?.[0]) return res.status(404).json({ success: false, error: '服务记录不存在' })
      return res.status(200).json({ success: true, data: { id } })
    }
    if ((req.method === 'POST' || req.method === 'PATCH') && resource === 'manual-applications') {
      const input = manualApplicationSchema.parse(req.body || {})
      if (req.method === 'PATCH' && !input.id) return res.status(400).json({ success: false, error: '缺少申请记录 ID' })
      const action = req.method === 'POST' ? 'manual_application_created' : 'manual_application_updated'
      const manualParams = [input.userId, input.jobTitle, input.companyName, input.jobUrl,
        input.applicationChannel, toNullableDate(input.appliedAt), input.status, input.notes, adminId, action]
      if (req.method === 'PATCH') manualParams.push(input.id)
      const rows = await neonHelper.query(req.method === 'POST' ? `WITH saved AS (
          INSERT INTO member_crm_manual_applications
            (user_id, job_title, company_name, job_url, application_channel, applied_at, current_status, notes, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id, admin_user_id, action, entity_type, entity_id, changed_fields)
          SELECT $1,$9,$10,'application',saved.id,'["jobTitle","companyName","jobUrl","applicationChannel","appliedAt","status","notes"]'::jsonb FROM saved
        ) SELECT saved.* FROM saved`
        : `WITH saved AS (
          UPDATE member_crm_manual_applications SET job_title=$2, company_name=$3, job_url=$4,
            application_channel=$5, applied_at=$6, current_status=$7, notes=$8, updated_by=$9, updated_at=NOW()
          WHERE id=$11 AND user_id=$1 AND archived_at IS NULL RETURNING *
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id, admin_user_id, action, entity_type, entity_id, changed_fields)
          SELECT $1,$9,$10,'application',saved.id,'["jobTitle","companyName","jobUrl","applicationChannel","appliedAt","status","notes"]'::jsonb FROM saved
        ) SELECT saved.* FROM saved`, manualParams)
      const saved = rows[0]
      if (!saved) return res.status(404).json({ success: false, error: '手动申请记录不存在' })
      return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data: saved })
    }
    if (req.method === 'DELETE' && resource === 'manual-applications') {
      const userId = userIdSchema.parse(req.query.userId)
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query(`WITH saved AS (
          UPDATE member_crm_manual_applications SET archived_at=NOW(), updated_by=$1, updated_at=NOW()
          WHERE id=$2 AND user_id=$3 AND archived_at IS NULL RETURNING id
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log (target_user_id,admin_user_id,action,entity_type,entity_id)
          SELECT $3,$1,'manual_application_archived','application',saved.id FROM saved
        ) SELECT saved.id FROM saved`, [adminId, id, userId])
      if (!rows?.[0]) return res.status(404).json({ success: false, error: '手动申请记录不存在' })
      return res.status(200).json({ success: true, data: { id } })
    }
    if (req.method === 'POST' && resource === 'application-events') {
      const input = applicationEventSchema.parse(req.body || {})
      const isSite = input.sourceKind === 'site'
      const siteId = isSite ? z.coerce.number().int().positive().parse(input.applicationId) : null
      const manualId = isSite ? null : z.string().uuid().parse(input.applicationId)
      if (isSite) {
        const target = await neonHelper.query('SELECT id FROM user_job_interactions WHERE id=$1 AND user_id=$2', [siteId, input.userId])
        if (!target?.[0]) return res.status(404).json({ success: false, error: '站内申请记录不存在' })
      } else {
        const target = await neonHelper.query('SELECT id FROM member_crm_manual_applications WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [manualId, input.userId])
        if (!target?.[0]) return res.status(404).json({ success: false, error: '手动申请记录不存在' })
      }
      const rows = await neonHelper.query(`WITH event_saved AS (
          INSERT INTO member_crm_application_events
            (user_id, site_interaction_id, manual_application_id, status, note, event_at, next_follow_up_at, created_by)
          VALUES ($1,$2,$3,$4,$5,COALESCE($6,NOW()),$7,$8) RETURNING *
        ), site_saved AS (
          UPDATE user_job_interactions SET status=$4, updated_at=NOW()
          WHERE $9::boolean AND id=$2 AND user_id=$1 RETURNING id
        ), manual_saved AS (
          UPDATE member_crm_manual_applications SET current_status=$4, updated_by=$8, updated_at=NOW()
          WHERE NOT $9::boolean AND id=$3 AND user_id=$1 RETURNING id
        ), profile_saved AS (
          INSERT INTO member_crm_profiles (user_id, last_contact_at, next_follow_up_at, created_by, updated_by)
          SELECT $1,COALESCE($6,NOW()),$7,$8,$8 WHERE $5 <> '' OR $7 IS NOT NULL
          ON CONFLICT (user_id) DO UPDATE SET last_contact_at=COALESCE($6,NOW()),
            next_follow_up_at=COALESCE(EXCLUDED.next_follow_up_at,member_crm_profiles.next_follow_up_at),
            updated_by=$8,updated_at=NOW() RETURNING user_id
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields,metadata)
          SELECT $1,$8,'application_event_added','application',$10,
            '["status","note","nextFollowUpAt"]'::jsonb,jsonb_build_object('sourceKind',$11)
        ) SELECT event_saved.* FROM event_saved`, [input.userId, siteId, manualId, input.status,
        input.note, toNullableDate(input.eventAt), toNullableDate(input.nextFollowUpAt), adminId, isSite,
        input.applicationId, input.sourceKind])
      return res.status(201).json({ success: true, data: rows[0] })
    }
    if (req.method === 'POST' && resource === 'resumes') {
      const userId = userIdSchema.parse(req.query.userId)
      const parsed = await parseMultipart(req, '简历')
      const extension = path.extname(parsed.fileName).toLowerCase().slice(1)
      if (!Object.prototype.hasOwnProperty.call(FILE_TYPES, extension)) return res.status(415).json({ success: false, error: '仅支持 PDF、DOCX、TXT 简历' })
      if (parsed.buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ success: false, error: '简历文件不能超过 10MB' })
      if (extension !== 'txt') {
        const detected = await fileTypeFromBuffer(parsed.buffer)
        if (!detected || detected.ext !== extension) return res.status(415).json({ success: false, error: '文件内容与扩展名不一致' })
      }
      const extracted = await extractResumeText(parsed.buffer, extension)
      const rows = await neonHelper.query(`WITH saved AS (
          INSERT INTO member_crm_resume_documents
            (user_id, file_name, file_type, mime_type, file_size, file_content, parse_status, content_text, notes, uploaded_by)
          VALUES ($1,$2,$3,$4,$5,decode($6,'base64'),$7,$8,$9,$10)
          RETURNING id, file_name, file_type, file_size, parse_status, notes, created_at
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
          SELECT $1,$10,'resume_uploaded','resume',saved.id,
            jsonb_build_object('fileName',$2,'fileSize',$5) FROM saved
        ) SELECT saved.* FROM saved`,
        [userId, sanitizeDbText(parsed.fileName), extension, FILE_TYPES[extension], parsed.buffer.length, encodeDbFile(parsed.buffer),
          extracted.status, sanitizeDbText(extracted.text), sanitizeDbText(parsed.fields.notes).slice(0, 5000), adminId])
      return res.status(201).json({ success: true, data: rows[0] })
    }
    if (req.method === 'POST' && resource === 'service-documents') {
      const userId = userIdSchema.parse(req.query.userId)
      const serviceId = z.string().uuid().parse(req.query.serviceId)
      const target = await neonHelper.query(`SELECT id FROM member_crm_service_records
        WHERE id=$1 AND user_id=$2 AND archived_at IS NULL`, [serviceId, userId])
      if (!target?.[0]) return res.status(404).json({ success: false, error: '服务记录不存在' })
      const parsed = await parseMultipart(req, '服务文档')
      const extension = path.extname(parsed.fileName).toLowerCase().slice(1)
      if (!Object.prototype.hasOwnProperty.call(FILE_TYPES, extension)) return res.status(415).json({ success: false, error: '服务文档仅支持 PDF、DOCX、TXT' })
      if (parsed.buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ success: false, error: '服务文档不能超过 10MB' })
      if (extension !== 'txt') {
        const detected = await fileTypeFromBuffer(parsed.buffer)
        if (!detected || detected.ext !== extension) return res.status(415).json({ success: false, error: '文件内容与扩展名不一致' })
      }
      const rows = await neonHelper.query(`WITH saved AS (
          INSERT INTO member_crm_service_documents
            (service_record_id,user_id,file_name,file_type,mime_type,file_size,file_content,notes,uploaded_by)
          VALUES ($1,$2,$3,$4,$5,$6,decode($7,'base64'),$8,$9)
          RETURNING id,file_name,file_type,file_size,notes,created_at
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
          SELECT $2,$9,'service_document_uploaded','service_document',saved.id,
            jsonb_build_object('serviceId',$1,'fileName',$3,'fileSize',$6) FROM saved
        ) SELECT saved.* FROM saved`, [serviceId, userId, sanitizeDbText(parsed.fileName), extension,
        FILE_TYPES[extension], parsed.buffer.length, encodeDbFile(parsed.buffer), sanitizeDbText(parsed.fields.notes).slice(0, 2000), adminId])
      const saved = rows[0]
      return res.status(201).json({ success: true, data: {
        id: saved.id, fileName: saved.file_name, fileType: saved.file_type, fileSize: saved.file_size,
        notes: saved.notes || '', createdAt: saved.created_at
      } })
    }
    if (req.method === 'GET' && resource === 'resume-file') {
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query('SELECT user_id, file_name, mime_type, file_content FROM member_crm_resume_documents WHERE id=$1', [id])
      const file = rows?.[0]
      if (!file) return res.status(404).json({ success: false, error: '简历不存在' })
      await writeAudit({ targetUserId: file.user_id, adminUserId: adminId, action: 'resume_downloaded', entityType: 'resume', entityId: id, metadata: { fileName: file.file_name } })
      const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment'
      const ascii = String(file.file_name).replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_') || `resume-${id}`
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`)
      return res.send(decodeDbFile(file.file_content))
    }
    if (req.method === 'GET' && resource === 'service-document-file') {
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query(`SELECT user_id,file_name,mime_type,file_content
        FROM member_crm_service_documents WHERE id=$1`, [id])
      const file = rows?.[0]
      if (!file) return res.status(404).json({ success: false, error: '服务文档不存在' })
      await writeAudit({ targetUserId: file.user_id, adminUserId: adminId, action: 'service_document_downloaded', entityType: 'service_document', entityId: id, metadata: { fileName: file.file_name } })
      const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment'
      const ascii = String(file.file_name).replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_') || `service-document-${id}`
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`)
      return res.send(decodeDbFile(file.file_content))
    }
    if (req.method === 'DELETE' && resource === 'resumes') {
      const userId = userIdSchema.parse(req.query.userId)
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query(`WITH saved AS (
          DELETE FROM member_crm_resume_documents WHERE id=$1 AND user_id=$2
          RETURNING id,file_name,file_size
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
          SELECT $2,$3,'resume_deleted','resume',saved.id,
            jsonb_build_object('fileName',saved.file_name,'fileSize',saved.file_size) FROM saved
        ) SELECT saved.* FROM saved`, [id, userId, adminId])
      if (!rows?.[0]) return res.status(404).json({ success: false, error: '简历不存在' })
      return res.status(200).json({ success: true, data: { id } })
    }
    if (req.method === 'DELETE' && resource === 'service-documents') {
      const userId = userIdSchema.parse(req.query.userId)
      const id = z.string().uuid().parse(req.query.id)
      const rows = await neonHelper.query(`WITH saved AS (
          DELETE FROM member_crm_service_documents WHERE id=$1 AND user_id=$2
          RETURNING id,file_name,file_size,service_record_id
        ), audit_saved AS (
          INSERT INTO member_crm_audit_log
            (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
          SELECT $2,$3,'service_document_deleted','service_document',saved.id,
            jsonb_build_object('serviceId',saved.service_record_id,'fileName',saved.file_name,'fileSize',saved.file_size)
          FROM saved
        ) SELECT saved.* FROM saved`, [id, userId, adminId])
      if (!rows?.[0]) return res.status(404).json({ success: false, error: '服务文档不存在' })
      return res.status(200).json({ success: true, data: { id } })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: error.issues[0]?.message || '数据格式错误' })
    const inputMessage = error instanceof Error ? error.message : ''
    if (inputMessage === '上传格式无效' || inputMessage.startsWith('请选择')) {
      return res.status(400).json({ success: false, error: inputMessage })
    }
    if (inputMessage.endsWith('不能超过 10MB')) {
      return res.status(413).json({ success: false, error: inputMessage })
    }
    console.error('[member-crm] API error:', error)
    return res.status(500).json({ success: false, error: '会员 CRM 暂时不可用，请稍后重试' })
  }
}
