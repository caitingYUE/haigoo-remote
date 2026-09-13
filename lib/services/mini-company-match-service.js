import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractStructuredResume } from './resume-structure-extractor.js'
import { buildMatchingProfile, scoreJobForUserProfile } from './matching-engine.js'
import { normalizeOpenRoleCategories } from '../shared/mini-company-presentation.js'

export const MINI_MATCH_ALGORITHM_VERSION = 'company-match-v3'
const HISTORY_TABLE = 'company_job_history'
const COMPANY_PROFILES_TABLE = 'company_hiring_profiles'
const RUNS_TABLE = 'mini_match_recommendation_runs'
const EXPOSURES_TABLE = 'mini_match_exposures'
const FOLLOWS_TABLE = 'mini_company_follows'
const EVENTS_TABLE = 'mini_company_update_events'
const INBOX_TABLE = 'mini_company_update_inbox'
const TICKETS_TABLE = 'mini_web_session_tickets'
const FIXED_MATCH_SNAPSHOT_ENABLED = String(process.env.MINI_MATCH_FIXED_SNAPSHOT_ENABLED || '').toLowerCase() === 'true'
const fixedMatchRecommendationsSql = (alias = 'snapshots') => FIXED_MATCH_SNAPSHOT_ENABLED
  ? `CASE WHEN jsonb_array_length(${alias}.fixed_recommendations) > 0 THEN ${alias}.fixed_recommendations ELSE ${alias}.recommendations END`
  : `${alias}.recommendations`

const ROLE_FAMILY_ALIASES = {
  product: ['产品', 'product', 'pm', 'product manager', '产品经理', '产品运营', '产品策划'],
  project: ['项目', 'project', 'program', '项目经理', 'program manager'],
  engineering: ['研发', '工程', 'software', 'developer', 'engineer', '开发', '技术', '测试', 'qa', '运维', 'sre', '安全', '架构', '硬件', '内核', 'devops'],
  design: ['设计', 'design', 'ux', 'ui', '视觉', '交互'],
  data: ['数据', 'data', 'analytics', '分析', 'machine learning', '机器学习'],
  marketing: ['市场', 'marketing', '品牌', 'growth', '增长', '内容营销'],
  sales: ['销售', 'sales', 'business development', '商务', '客户成功', '客户经理'],
  operations: ['运营', 'operations', 'community', '社群', '用户运营', '客户服务', '客户支持', '内容创作', '编辑', '视频剪辑', '供应链', '采购'],
  research: ['研究', 'research', '用户研究', 'ux research', '教育', '课程', '咨询'],
  finance: ['财务', 'finance', 'accounting', '会计', '投资', '经济'],
  hr: ['人力', 'hr', 'human resources', '招聘', '人才', '行政', '法务']
}

const ROLE_FAMILY_LABELS = {
  product: '产品', project: '项目', engineering: '研发', design: '设计', data: '数据',
  marketing: '市场', sales: '销售', operations: '运营', research: '研究', finance: '财务', hr: '人力'
}

function unique(values, limit = 24) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap((value) => String(value || '').split(/[,，、|/]+/))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 1))].slice(0, limit)
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex')
}

function roleFamiliesForText(value) {
  const text = String(value || '').toLowerCase()
  return Object.entries(ROLE_FAMILY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias.toLowerCase())))
    .map(([key]) => key)
}

function roleFamilyLabels(families) {
  return unique(families, 4).map((family) => ROLE_FAMILY_LABELS[family] || family)
}

function listValue(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Keep plain text tags usable when a legacy row was not stored as JSON.
    }
    return value.split(/[,，、|/]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function daysSince(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86400000) : 9999
}

function evidenceWeight(row) {
  const age = daysSince(row.source_published_at || row.last_seen_at)
  if (!row.closed_at && row.is_public_opportunity) return 1
  if (age <= 90) return 0.9
  if (age <= 365) return 0.75
  return 0.55
}

function companyIndustryMatch(profile, company) {
  const candidateIndustries = unique(profile.industries)
  const companyText = String([company.industry, company.description, ...(company.tags || [])].join(' ')).toLowerCase()
  if (!candidateIndustries.length || !companyText) return 0.35
  return candidateIndustries.some((industry) => companyText.includes(industry)) ? 1 : 0.15
}

function remoteMatch(profile, history) {
  const preferences = [profile.eligibleLocations, profile.profile?.location, profile.profile?.timezone]
    .flatMap((value) => unique(value))
  if (!preferences.length) return 0.55
  const text = String([history.location, history.timezone].join(' ')).toLowerCase()
  if (!text || /global|worldwide|anywhere|全球|不限地区|remote/i.test(text)) return 1
  return preferences.some((value) => text.includes(value)) ? 0.85 : 0.3
}

function jobHistoryFeatures(row) {
  const structured = extractStructuredResume(`${row.title || ''}\n${row.category || ''}\n${row.description || ''}`)
  return {
    ...row,
    job_id: String(row.source_job_id || row.history_id || '').replace(/\s+/g, ' ').trim(),
    jobId: String(row.source_job_id || row.history_id || '').replace(/\s+/g, ' ').trim(),
    title: row.title || '',
    description: row.description || '',
    category: row.category || '',
    industry: row.industry || '',
    experience_level: row.experience_level || '',
    location: row.location || '',
    timezone: row.timezone || '',
    roleFamilies: unique([...listValue(row.role_families), ...structured.roleFamilies, ...roleFamiliesForText(`${row.title} ${row.category}`)], 12),
    skills: unique([...listValue(row.normalized_skills), ...structured.skills], 40)
  }
}

export function buildStructuredCareerProfile(careerText, intake = {}) {
  const redactedText = String(careerText || '').trim()
  const structured = extractStructuredResume(`${redactedText}\n${intake.targetRoles || ''}\n${intake.careerGoal || ''}`)
  const profile = buildMatchingProfile({
    ...structured,
    targetRole: intake.targetRoles || structured.targetRole,
    roleSignals: [...(structured.roles || []), intake.targetRoles || ''],
    resumeText: redactedText,
    preferences: intake,
    eligibleLocations: [intake.location, intake.timezone].filter(Boolean),
    hasResume: true,
    profileVersion: structured.parser_version || 'deterministic-v1'
  })
  const structuredProfile = {
    parserVersion: structured.parser_version || structured.parserVersion,
    roleFamilies: profile.roleFamilies,
    roleTerms: profile.roleTerms,
    roles: structured.roles || [],
    skills: profile.skills,
    tools: structured.tools || [],
    industries: profile.industries,
    languages: profile.languages,
    experienceYears: profile.experienceYears,
    seniority: structured.career_level || '',
    eligibleLocations: profile.eligibleLocations,
    evidenceCoverage: profile.evidenceCoverage,
    profile: { ...intake }
  }
  const completeness = Number(profile.evidenceCoverage || 0)
  return {
    structuredProfile,
    matchingProfile: profile,
    profileHash: hash(structuredProfile),
    profileCompleteness: Math.max(0, Math.min(1, completeness))
  }
}

export function buildDeterministicCareerResult(careerText, intake = {}) {
  const { structuredProfile } = buildStructuredCareerProfile(careerText, intake)
  const labels = roleFamilyLabels(structuredProfile.roleFamilies)
  const headline = labels.length ? `${labels.slice(0, 2).join('与')}方向，适合继续深挖远程机会` : '先从你的经历里找到远程方向'
  const positioning = structuredProfile.experienceYears
    ? `你有约 ${structuredProfile.experienceYears} 年相关经历，可以先从${labels[0] || '现有'}方向寻找更匹配的远程团队。`
    : `从已有经历看，${labels[0] || '你的核心能力'}是下一步整理远程方向的起点。`
  const strengths = [
    labels.length ? { title: `${labels.slice(0, 2).join('、')}经验`, explanation: '你的经历里已经出现稳定的角色线索。', confidence: 'medium' } : null,
    structuredProfile.skills?.length ? { title: '可迁移技能', explanation: `已识别 ${structuredProfile.skills.slice(0, 4).join('、')} 等技能。`, confidence: 'medium' } : null,
    structuredProfile.experienceYears ? { title: '经历基础', explanation: '已有项目或工作经历，可以直接用于匹配企业招聘方向。', confidence: 'medium' } : null
  ].filter(Boolean)
  const primaryRole = labels[0] || '远程协作岗位'
  return {
    summary: { headline, positioning },
    strengths,
    careerPaths: {
      now: [{ roleName: primaryRole, whyFit: '与你已有经历的角色线索最接近。', mainGaps: [], preparationActions: ['补充一个代表性项目和可量化结果'], confidence: 'medium' }],
      bridge: labels[1] ? [{ roleName: labels[1], whyFit: '与你的相邻经验有可迁移部分。', mainGaps: [], preparationActions: [], confidence: 'low' }] : [],
      later: []
    },
    candidateProfile: structuredProfile,
    clarificationQuestions: [],
    remoteReadiness: [
      { key: 'timezone', label: '时区与所在地', confirmed: Boolean(intake.timezone && intake.location) },
      { key: 'schedule', label: '可工作时间', confirmed: Boolean(intake.weeklyHours || intake.availability) },
      { key: 'language', label: '工作语言', confirmed: Boolean(intake.languages) },
      { key: 'work_mode', label: '工作方式', confirmed: Boolean(intake.workMode) }
    ],
    companies: []
  }
}

export function isEligibleDirectoryJob(job = {}) {
  const status = String(job.status || '').toLowerCase()
  const approved = (job.isApproved ?? job.is_approved) === true
  const memberOnly = Boolean(job.memberOnly ?? job.member_only)
  const url = String(job.url || job.sourceUrl || '').trim()
  const email = String(job.hiringEmail || job.hiring_email || job.trusted_hiring_email || '').trim()
  const hasApplication = /^https?:\/\/\S+$/i.test(url) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return status === 'active' && approved && !memberOnly && hasApplication
}

async function companyHistoryQuery(client, query, params = []) {
  if (client?.query) return client.query(query, params)
  if (typeof client === 'function') return client(query, params)
  return neonHelper.query(query, params)
}

export async function archiveJobSnapshot(job, {
  closed = false,
  firstSeenAt = null,
  client = null,
  trustedCompanyStatus = null,
  trustedHiringEmail = null
} = {}) {
  if ((!neonHelper.isConfigured && !client) || !job) return null
  const companyId = String(job.companyId || job.company_id || '').trim()
  if (!companyId) return null
  const sourceJobId = String(job.id || job.job_id || '').trim()
  const sourceUrl = String(job.url || job.sourceUrl || '').trim() || sourceJobId
  const title = String(job.title || '').trim()
  if (!sourceJobId || !sourceUrl || !title) return null
  const structured = extractStructuredResume(`${job.title || ''}\n${job.category || ''}\n${job.description || ''}`)
  const roleFamilies = unique([...structured.roleFamilies, ...roleFamiliesForText(`${job.title} ${job.category}`)], 12)
  const skills = unique([...(Array.isArray(job.tags) ? job.tags : []), ...(Array.isArray(job.skills) ? job.skills : []), ...structured.skills], 40)
  const payloadHash = hash({ title: job.title, description: job.description, category: job.category, url: sourceUrl, location: job.location, status: job.status, approved: job.isApproved ?? job.is_approved })
  let companyStatus = trustedCompanyStatus
  let companyHiringEmail = trustedHiringEmail
  if (companyStatus === null) {
    const companyRows = await companyHistoryQuery(
      client,
      'SELECT status, hiring_email FROM trusted_companies WHERE company_id = $1 LIMIT 1',
      [companyId]
    )
    companyStatus = companyRows?.[0]?.status || ''
    companyHiringEmail = companyRows?.[0]?.hiring_email || ''
  }
  const eligible = !closed
    && String(companyStatus || '').toLowerCase() === 'active'
    && isEligibleDirectoryJob({ ...job, hiringEmail: job.hiringEmail || job.hiring_email || companyHiringEmail })
  const sourceUrlHash = hash(sourceUrl)
  const existingRows = await companyHistoryQuery(
    client,
    `SELECT history_id, source_url_hash
       FROM ${HISTORY_TABLE}
      WHERE company_id = $1 AND source_job_id = $2
      LIMIT 1`,
    [companyId, sourceJobId]
  )
  const existing = existingRows?.[0] || null

  if (!eligible) {
    const rows = await companyHistoryQuery(
      client,
      `UPDATE ${HISTORY_TABLE}
          SET last_seen_at = NOW(), closed_at = COALESCE(closed_at, NOW()),
              is_public_opportunity = FALSE, payload_hash = $4, updated_at = NOW()
        WHERE company_id = $1
          AND (source_job_id = $2 OR (source_job_id IS NULL AND source_url_hash = $3))
        RETURNING history_id, payload_hash`,
      [companyId, sourceJobId, sourceUrlHash, payloadHash]
    )
    return rows?.[0] || null
  }

  let safeSourceUrlHash = sourceUrlHash
  const collisionRows = await companyHistoryQuery(
    client,
    `SELECT history_id, source_job_id
       FROM ${HISTORY_TABLE}
      WHERE company_id = $1 AND source_url_hash = $2
      LIMIT 1`,
    [companyId, sourceUrlHash]
  )
  const collision = collisionRows?.[0]
  if (collision && String(collision.history_id) !== String(existing?.history_id || '')) {
    safeSourceUrlHash = hash(`${sourceUrl}\n${sourceJobId}`)
  }

  const params = [
    companyId, sourceJobId, safeSourceUrlHash, title, String(job.description || ''), String(job.category || ''),
    JSON.stringify(roleFamilies), JSON.stringify(skills), String(job.industry || ''),
    String(job.experienceLevel || job.experience_level || ''), String(job.location || job.region || ''),
    String(job.timezone || ''), firstSeenAt, job.publishedAt || job.published_at || null,
    payloadHash, 0.9
  ]

  if (existing) {
    const rows = await companyHistoryQuery(
      client,
      `UPDATE ${HISTORY_TABLE}
          SET source_url_hash = $3, title = $4, description = $5, category = $6,
              role_families = $7::jsonb, normalized_skills = $8::jsonb,
              industry = $9, experience_level = $10, location = $11, timezone = $12,
              first_seen_at = COALESCE(first_seen_at, $13::timestamptz, NOW()),
              last_seen_at = NOW(), source_published_at = $14::timestamptz,
              closed_at = NULL, payload_hash = $15, evidence_quality = $16,
              is_public_opportunity = TRUE, updated_at = NOW()
        WHERE history_id = $17 AND company_id = $1 AND source_job_id = $2
        RETURNING history_id, payload_hash`,
      [...params, existing.history_id]
    )
    return rows?.[0] || null
  }

  const rows = await companyHistoryQuery(
    client,
    `INSERT INTO ${HISTORY_TABLE} (
       company_id, source_job_id, source_url_hash, title, description, category,
       role_families, normalized_skills, industry, experience_level, location, timezone,
       first_seen_at, last_seen_at, source_published_at, closed_at, payload_hash,
       evidence_quality, is_public_opportunity, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12,
       COALESCE($13::timestamptz, NOW()), NOW(), $14::timestamptz, NULL,
       $15, $16, TRUE, NOW())
     ON CONFLICT (company_id, source_url_hash) DO UPDATE SET
       source_job_id = EXCLUDED.source_job_id, title = EXCLUDED.title,
       description = EXCLUDED.description, category = EXCLUDED.category,
       role_families = EXCLUDED.role_families, normalized_skills = EXCLUDED.normalized_skills,
       industry = EXCLUDED.industry, experience_level = EXCLUDED.experience_level,
       location = EXCLUDED.location, timezone = EXCLUDED.timezone,
       last_seen_at = NOW(), source_published_at = EXCLUDED.source_published_at,
       closed_at = EXCLUDED.closed_at, payload_hash = EXCLUDED.payload_hash,
       evidence_quality = EXCLUDED.evidence_quality,
       is_public_opportunity = EXCLUDED.is_public_opportunity, updated_at = NOW()
     WHERE ${HISTORY_TABLE}.source_job_id IS NULL
        OR ${HISTORY_TABLE}.source_job_id = EXCLUDED.source_job_id
     RETURNING history_id, payload_hash`,
    params
  )
  return rows?.[0] || null
}

export async function reconcileCompanyDirectoryHistory(companyId, { client = null, rebuild = true } = {}) {
  const id = String(companyId || '').trim()
  if (!id || (!neonHelper.isConfigured && !client)) return { companyId: id, reconciled: 0 }
  const jobs = await companyHistoryQuery(
    client,
    `SELECT jobs.*, companies.status AS trusted_company_status,
            companies.hiring_email AS trusted_hiring_email
       FROM trusted_companies companies
       LEFT JOIN jobs ON jobs.company_id = companies.company_id
      WHERE companies.company_id = $1
      ORDER BY jobs.job_id ASC`,
    [id]
  )
  const companyStatus = jobs?.[0]?.trusted_company_status || ''
  const trustedHiringEmail = jobs?.[0]?.trusted_hiring_email || ''
  let reconciled = 0
  for (const job of jobs || []) {
    if (!job.job_id) continue
    await archiveJobSnapshot(
      { ...job, companyId: id, hiringEmail: trustedHiringEmail },
      { client, trustedCompanyStatus: companyStatus, trustedHiringEmail }
    )
    reconciled += 1
  }
  await companyHistoryQuery(
    client,
    `UPDATE ${HISTORY_TABLE} history
        SET closed_at = COALESCE(closed_at, NOW()), is_public_opportunity = FALSE, updated_at = NOW()
      WHERE history.company_id = $1
        AND (
          $2::text <> 'active'
          OR history.source_job_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM jobs
             WHERE jobs.job_id = history.source_job_id AND jobs.company_id = $1
          )
        )`,
    [id, String(companyStatus || '').toLowerCase()]
  )
  if (rebuild) {
    try {
      await rebuildCompanyHiringProfile(id)
    } catch (error) {
      console.warn(`[mini-company-match] Profile rebuild failed for ${id}:`, error?.message || error)
    }
  }
  return { companyId: id, reconciled }
}

export async function rebuildCompanyHiringProfile(companyId) {
  const rows = await neonHelper.query(`SELECT * FROM ${HISTORY_TABLE} WHERE company_id = $1 ORDER BY last_seen_at DESC`, [companyId])
  const roleDistribution = {}
  const skillDistribution = {}
  const seniorityDistribution = {}
  const remoteDistribution = {}
  let latestEvidenceAt = null
  let currentOpportunityCount = 0
  for (const row of rows || []) {
    const feature = jobHistoryFeatures(row)
    if (!Array.isArray(row.role_families) || row.role_families.length === 0 || !Array.isArray(row.normalized_skills) || row.normalized_skills.length === 0) {
      await neonHelper.query(
        `UPDATE ${HISTORY_TABLE} SET role_families = $1::jsonb, normalized_skills = $2::jsonb, updated_at = NOW() WHERE history_id = $3`,
        [JSON.stringify(feature.roleFamilies || []), JSON.stringify(feature.skills || []), row.history_id]
      )
    }
    const weight = evidenceWeight(row)
    for (const family of feature.roleFamilies) roleDistribution[family] = (roleDistribution[family] || 0) + weight
    for (const skill of feature.skills) skillDistribution[skill] = (skillDistribution[skill] || 0) + weight
    if (feature.experience_level) seniorityDistribution[feature.experience_level] = (seniorityDistribution[feature.experience_level] || 0) + weight
    const remoteKey = /global|worldwide|anywhere|全球|不限地区|remote/i.test(`${feature.location} ${feature.timezone}`) ? 'global' : 'restricted'
    remoteDistribution[remoteKey] = (remoteDistribution[remoteKey] || 0) + weight
    if (row.is_public_opportunity) currentOpportunityCount += 1
    if (!latestEvidenceAt || new Date(row.last_seen_at) > new Date(latestEvidenceAt)) latestEvidenceAt = row.last_seen_at
  }
  const fingerprint = hash({ roleDistribution, skillDistribution, seniorityDistribution, remoteDistribution, evidenceCount: rows?.length || 0, currentOpportunityCount, latestEvidenceAt })
  const current = await neonHelper.query(`SELECT profile_version, fingerprint_hash FROM ${COMPANY_PROFILES_TABLE} WHERE company_id = $1 LIMIT 1`, [companyId])
  const nextVersion = Number(current?.[0]?.profile_version || 0) + (current?.[0]?.fingerprint_hash === fingerprint ? 0 : 1)
  await neonHelper.query(
    `INSERT INTO ${COMPANY_PROFILES_TABLE} (
       company_id, profile_version, role_distribution, skill_distribution,
       seniority_distribution, remote_distribution, evidence_count,
       current_opportunity_count, latest_evidence_at, fingerprint_hash,
       algorithm_version, updated_at
     ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (company_id) DO UPDATE SET
       profile_version = EXCLUDED.profile_version, role_distribution = EXCLUDED.role_distribution,
       skill_distribution = EXCLUDED.skill_distribution, seniority_distribution = EXCLUDED.seniority_distribution,
       remote_distribution = EXCLUDED.remote_distribution, evidence_count = EXCLUDED.evidence_count,
       current_opportunity_count = EXCLUDED.current_opportunity_count, latest_evidence_at = EXCLUDED.latest_evidence_at,
       fingerprint_hash = EXCLUDED.fingerprint_hash, algorithm_version = EXCLUDED.algorithm_version, updated_at = NOW()`,
    [companyId, Math.max(1, nextVersion), JSON.stringify(roleDistribution), JSON.stringify(skillDistribution), JSON.stringify(seniorityDistribution), JSON.stringify(remoteDistribution), rows?.length || 0, currentOpportunityCount, latestEvidenceAt, fingerprint, MINI_MATCH_ALGORITHM_VERSION]
  )
  return { companyId, evidenceCount: rows?.length || 0, fingerprint }
}

// Events are captured transactionally by migration 089 for every job write path.
// Fan-out is one statement: failure rolls back both inbox inserts and prepared_at.
export async function prepareCompanyUpdateEvents({ limit = 100 } = {}) {
  const events = await neonHelper.query(
    `SELECT event_id, job_snapshot FROM ${EVENTS_TABLE} WHERE prepared_at IS NULL
      ORDER BY occurred_at, event_id LIMIT $1`, [Math.min(100, Math.max(1, limit))])
  for (const event of events) {
    const job = event.job_snapshot || {}
    const structured = extractStructuredResume(`${job.title || ''}\n${job.category || ''}\n${job.description || ''}`)
    const families = unique([...(structured.roleFamilies || []), ...roleFamiliesForText(`${job.title || ''} ${job.category || ''}`)], 12)
    await neonHelper.query(
      `WITH event AS (
         UPDATE ${EVENTS_TABLE} SET role_families=$2::jsonb, prepared_at=NOW()
          WHERE event_id=$1 AND prepared_at IS NULL RETURNING *
       ), recipients AS (
         SELECT f.user_id, f.authorization_id, 'follow' AS source,
           f.wechat_enabled AND f.wechat_template_status='accepted' AND f.authorized_at<=e.occurred_at AS authorized
         FROM event e JOIN ${FOLLOWS_TABLE} f ON f.company_id=e.company_id
         JOIN users u ON u.user_id=f.user_id AND u.status='active'
         WHERE f.status='active' AND f.in_app_enabled AND f.subscribed_at<=e.occurred_at
         UNION ALL
         SELECT p.user_id, p.authorization_id, 'direction' AS source,
           p.wechat_enabled AND p.wechat_template_status='accepted' AND p.authorized_at<=e.occurred_at AS authorized
         FROM event e JOIN career_watch_profiles p ON p.status='active' AND p.in_app_enabled AND p.subscribed_at<=e.occurred_at
         JOIN users u ON u.user_id=p.user_id AND u.status='active'
         WHERE u.member_status IN ('active', 'pro', 'lifetime') AND COALESCE(u.member_type,'') NOT IN ('none','trial_week')
           AND (u.member_cycle_start_at IS NULL OR u.member_cycle_start_at<=NOW())
           AND (u.member_expire_at IS NULL OR u.member_expire_at>NOW())
           AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(e.role_families) r(value) WHERE p.role_families ? r.value)
           AND (p.source_mode<>'manual' OR jsonb_array_length(COALESCE(p.custom_role_terms,'[]'::jsonb))=0
             OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.custom_role_terms) t(value) WHERE $3 ILIKE '%'||t.value||'%'))
       ), chosen AS (
         SELECT DISTINCT ON (user_id) * FROM recipients ORDER BY user_id, authorized DESC, source DESC
       )
       INSERT INTO ${INBOX_TABLE}(user_id,event_id,notification_status,authorization_id,authorization_source)
       SELECT c.user_id,e.event_id,CASE WHEN c.authorized THEN 'pending' ELSE 'not_requested' END,c.authorization_id,c.source
       FROM chosen c CROSS JOIN event e ON CONFLICT (user_id, event_id) DO NOTHING`,
      [event.event_id, JSON.stringify(families), `${job.title || ''} ${job.category || ''}`.trim()])
  }
  return events.length
}

export { wechatMiniProgramState } from './mini-wechat-reminder-service.js'

async function loadCandidateProfile(profileRow) {
  const stored = profileRow?.structured_profile && typeof profileRow.structured_profile === 'object' ? profileRow.structured_profile : null
  if (stored) return buildMatchingProfile({ ...stored, resumeText: profileRow.career_text, preferences: profileRow.intake || {}, hasResume: true, profileVersion: profileRow.version })
  return buildStructuredCareerProfile(profileRow?.career_text || '', profileRow?.intake || {}).matchingProfile
}

export function scoreCompanyJobFit(score) {
  const total = Number(score?.totalScore || 0)
  const evidence = Number(score?.breakdown?.evidenceScore || 0)
  const title = Number(score?.breakdown?.titleMatch || 0)
  const role = Number(score?.breakdown?.roleTypeMatch || 0)
  const roleAlignment = title >= 68 && role >= 78 ? title * 0.55 + role * 0.45 : 0
  return Math.max(total, evidence, roleAlignment)
}

export function computeCompanyMatch(profile, company, historyRows) {
  const features = (historyRows || []).map(jobHistoryFeatures)
  if (!features.length) return null
  const scored = features.map((feature) => ({ feature, score: scoreJobForUserProfile(profile, feature) }))
  scored.sort((a, b) => scoreCompanyJobFit(b.score) - scoreCompanyJobFit(a.score))
  const best = scoreCompanyJobFit(scored[0]?.score)
  const topThreeAverage = scored.slice(0, 3).reduce((sum, item) => sum + scoreCompanyJobFit(item.score), 0) / Math.min(3, scored.length)
  const roleFamilies = new Set(profile.roleFamilies || [])
  const direct = features.filter((feature) => feature.roleFamilies?.some((family) => roleFamilies.has(family))).length
  const roleRepeat = Math.min(100, direct * 35)
  const hiringFit = best * 0.5 + topThreeAverage * 0.3 + roleRepeat * 0.2
  const industryFit = companyIndustryMatch(profile, company) * 100
  const remoteFit = Math.max(...features.map((feature) => remoteMatch(profile, feature))) * 100
  const evidenceQuality = features.reduce((sum, row) => sum + Number(row.evidence_quality || 0.5), 0) / features.length * 100
  const completeness = Number(profile.evidenceCoverage || 0.3) * 100
  const total = hiringFit * 0.7 + industryFit * 0.12 + remoteFit * 0.08 + evidenceQuality * 0.05 + completeness * 0.05
  const hasDirectRoleEvidence = direct > 0 || scored.some(({ score }) => (
    Number(score?.breakdown?.titleMatch || 0) >= 60 || Number(score?.breakdown?.roleTypeMatch || 0) >= 72
  ))
  const currentOpportunity = scored.some(({ feature, score }) => feature.is_public_opportunity && (
    feature.roleFamilies?.some((family) => roleFamilies.has(family)) ||
    (Number(score?.breakdown?.titleMatch || 0) >= 60 && Number(score?.breakdown?.roleTypeMatch || 0) >= 72)
  ))
  const band = total >= 80 ? 'high' : total >= 68 ? 'notable' : total >= 56 ? 'explore' : null
  if (!band || !hasDirectRoleEvidence) return null
  const matchedFamilies = roleFamilyLabels([...new Set(features.flatMap((feature) => feature.roleFamilies || []).filter((family) => roleFamilies.has(family)))])
  const recentCount = features.filter((feature) => daysSince(feature.source_published_at || feature.last_seen_at) <= 180).length
  const reasons = []
  if (matchedFamilies.length) reasons.push(`过去${recentCount ? '一段时间内' : ''}出现过${matchedFamilies.slice(0, 2).join('、')}方向岗位`)
  if (Number(scored[0]?.score?.breakdown?.skillMatch || 0) >= 55) reasons.push('你的技能与企业招聘方向有直接重合')
  if (currentOpportunity) reasons.push('当前存在公开且可访问的相关申请机会')
  if (!reasons.length) reasons.push('企业历史招聘方向与你的经历相近')
  const bestPublicOpportunity = scored.find(({ feature, score }) => feature.is_public_opportunity && (
    feature.roleFamilies?.some((family) => roleFamilies.has(family)) ||
    (Number(score?.breakdown?.titleMatch || 0) >= 60 && Number(score?.breakdown?.roleTypeMatch || 0) >= 72)
  ))?.feature
  return {
    companyId: String(company.company_id),
    name: String(company.name || ''),
    industry: String(company.industry || ''),
    description: String(company.description || '').trim(),
    logoFileId: String(company.cached_logo_url || '').startsWith('cloud://') ? String(company.cached_logo_url) : '',
    _logoSourcePath: String(company.logo || '').trim() || (String(company.cached_logo_url || '').startsWith('/api/company-assets?') ? company.cached_logo_url : ''),
    fitBand: band,
    reasons: reasons.slice(0, 2),
    evidenceSummary: features[0].last_seen_at
      ? `${features.length} 条招聘证据，最近更新于 ${new Date(features[0].last_seen_at).toLocaleDateString('zh-CN')}`
      : `${features.length} 条招聘证据`,
    hasPublicOpportunity: currentOpportunity,
    opportunity: bestPublicOpportunity ? {
      jobId: String(bestPublicOpportunity.jobId || bestPublicOpportunity.job_id || '').replace(/\s+/g, ' ').trim(),
      title: String(bestPublicOpportunity.title || '')
    } : null,
    score: Math.round(total),
    latestEvidenceAt: features[0].last_seen_at || null
  }
}

async function getCatalogVersion() {
  const rows = await neonHelper.query(`SELECT COUNT(*)::int AS count, COALESCE(MAX(updated_at), '1970-01-01T00:00:00Z'::timestamptz) AS updated_at FROM ${COMPANY_PROFILES_TABLE}`)
  return `${Number(rows?.[0]?.count || 0)}:${String(rows?.[0]?.updated_at || '')}`
}

async function loadTrustedLiveJobs() {
  try {
    return await neonHelper.query(`
      SELECT
        'live:' || j.job_id AS history_id,
        tc.company_id,
        j.job_id AS source_job_id,
        NULLIF(BTRIM(j.title), '') AS title,
        COALESCE(j.description, '') AS description,
        COALESCE(j.category, '') AS category,
        COALESCE(j.industry, tc.industry, '') AS industry,
        COALESCE(j.experience_level, '') AS experience_level,
        COALESCE(j.location, j.region, '') AS location,
        COALESCE(j.timezone, '') AS timezone,
        COALESCE(j.published_at, j.created_at, j.updated_at) AS first_seen_at,
        COALESCE(j.updated_at, j.published_at, j.created_at) AS last_seen_at,
        j.published_at AS source_published_at,
        NULL::timestamptz AS closed_at,
        COALESCE(to_jsonb(j.tags), '[]'::jsonb) AS normalized_skills,
        CASE WHEN LENGTH(COALESCE(j.description, '')) >= 200 THEN 0.9 ELSE 0.65 END AS evidence_quality,
        NULLIF(BTRIM(j.url), '') IS NOT NULL AS is_public_opportunity
      FROM jobs j
      JOIN trusted_companies tc
        ON tc.company_id = j.company_id
        OR (j.company_id IS NULL AND LOWER(BTRIM(tc.name)) = LOWER(BTRIM(j.company)))
      WHERE tc.status = 'active'
        AND j.status = 'active'
        AND j.is_approved = TRUE
      ORDER BY COALESCE(j.updated_at, j.published_at, j.created_at) DESC NULLS LAST, j.job_id DESC
    `)
  } catch (error) {
    console.warn('[mini-match] live trusted job catalog unavailable; using history', error?.message || error)
    return []
  }
}

function mergeCompanyEvidence(history = [], liveJobs = []) {
  const grouped = new Map()
  const seen = new Set()
  for (const row of [...liveJobs, ...history]) {
    const companyId = String(row?.company_id || '').trim()
    if (!companyId) continue
    const sourceJobId = String(row?.source_job_id || '').trim()
    const key = `${companyId}:${sourceJobId || String(row?.history_id || row?.title || '')}`
    if (sourceJobId && seen.has(key)) continue
    if (sourceJobId) seen.add(key)
    if (!grouped.has(companyId)) grouped.set(companyId, [])
    grouped.get(companyId).push(row)
  }
  for (const rows of grouped.values()) {
    rows.sort((a, b) => new Date(b?.last_seen_at || 0).getTime() - new Date(a?.last_seen_at || 0).getTime())
  }
  return grouped
}

function recommendationItems(value) {
  return Array.isArray(value) ? value.filter((item) => item && item.companyId) : []
}

function recommendationTime(item, run, fallbackTime = Date.now()) {
  const time = new Date(item?.firstMatchedAt || run?.generated_at || run?.generatedAt || fallbackTime).getTime()
  return Number.isFinite(time) ? time : fallbackTime
}

export function collectRecentMatchRecommendations({ runs = [], activeCompanyIds = [], now = new Date() } = {}) {
  const nowTime = Number.isFinite(new Date(now).getTime()) ? new Date(now).getTime() : Date.now()
  const cutoff = nowTime - 7 * 86400000
  const active = new Set(activeCompanyIds.map((id) => String(id)))
  const seen = new Set()
  const recommendations = []
  for (const run of runs) {
    for (const item of recommendationItems(run?.recommendations)) {
      const companyId = String(item.companyId)
      if (recommendationTime(item, run, nowTime) < cutoff || (active.size && !active.has(companyId)) || seen.has(companyId)) continue
      seen.add(companyId)
      recommendations.push(item)
    }
  }
  return recommendations
}

export function selectMatchRecommendations({ candidates = [], recentRuns = [], activeCompanyIds = [], limit = 3, now = new Date() } = {}) {
  const max = Math.max(1, Math.min(12, Number(limit) || 3))
  const nowDate = now instanceof Date ? now : new Date(now)
  const nowTime = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now()
  const cutoff = nowTime - 7 * 86400000
  const recentCompanyIds = new Set(recentRuns.flatMap((run) => recommendationItems(run?.recommendations)
    .filter((item) => recommendationTime(item, run, nowTime) >= cutoff)
    .map((item) => String(item.companyId))))
  const fresh = candidates.filter((item) => !recentCompanyIds.has(String(item.companyId)))
  const recommendations = fresh.slice(0, max).map((item) => ({ ...item, firstMatchedAt: nowDate.toISOString() }))
  const active = new Set(activeCompanyIds.map((id) => String(id)))
  const seen = new Set(recommendations.map((item) => String(item.companyId)))
  for (const run of recentRuns) {
    for (const item of recommendationItems(run?.recommendations)) {
      const companyId = String(item.companyId)
      const firstMatchedAt = new Date(recommendationTime(item, run, nowTime)).toISOString()
      if (new Date(firstMatchedAt).getTime() >= cutoff && (!active.size || active.has(companyId)) && !seen.has(companyId)) {
        seen.add(companyId)
        recommendations.push({ ...item, firstMatchedAt })
      }
      if (recommendations.length >= max) break
    }
    if (recommendations.length >= max) break
  }
  return { recommendations, fallbackUsed: recommendations.length > fresh.length, recentCompanyIds: [...recentCompanyIds] }
}

async function loadRecommendations(profileRow, userId, { recentRuns = [], limit = 12 } = {}) {
  // The authenticated user id is intentionally passed into loadRecommendations(profileRow, userId).
  const matchingProfile = await loadCandidateProfile(profileRow)
  const [companies, history, liveJobs, catalogVersion] = await Promise.all([
    neonHelper.query(`SELECT company_id, name, description, industry, tags, logo, cached_logo_url FROM trusted_companies WHERE status = 'active'`),
    neonHelper.query(`SELECT * FROM ${HISTORY_TABLE} ORDER BY last_seen_at DESC`),
    loadTrustedLiveJobs(),
    getCatalogVersion()
  ])
  const grouped = mergeCompanyEvidence(history, liveJobs)
  const candidates = (companies || [])
    .map((company) => computeCompanyMatch(matchingProfile, company, grouped.get(String(company.company_id)) || []))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'zh-CN'))
  const selection = selectMatchRecommendations({ candidates, recentRuns, activeCompanyIds: (companies || []).map((company) => company.company_id), limit })
  const mode = selection.fallbackUsed ? 'carry' : selection.recommendations.length ? 'fresh' : 'empty'
  const dailyCatalogVersion = `${catalogVersion}:daily:${new Date().toISOString().slice(0, 10)}:${mode}`
  const inputHash = hash({ profile: profileRow.profile_hash, catalogVersion, recentCompanyIds: selection.recentCompanyIds.sort(), algorithm: MINI_MATCH_ALGORITHM_VERSION })
  await neonHelper.query(
    `INSERT INTO ${RUNS_TABLE} (profile_id, user_id, profile_version, catalog_version, algorithm_version, input_hash, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (user_id, profile_version, catalog_version, algorithm_version) DO UPDATE SET
       recommendations = EXCLUDED.recommendations, input_hash = EXCLUDED.input_hash, generated_at = NOW()
     RETURNING run_id, generated_at`,
    [profileRow.profile_id, userId, profileRow.version, dailyCatalogVersion, MINI_MATCH_ALGORITHM_VERSION, inputHash, JSON.stringify(selection.recommendations)]
  )
  await neonHelper.query(`UPDATE mini_career_profiles SET last_match_at = NOW() WHERE profile_id = $1`, [profileRow.profile_id])
  return { recommendations: selection.recommendations, catalogVersion: dailyCatalogVersion, source: 'recomputed', generatedAt: new Date().toISOString(), fallbackUsed: selection.fallbackUsed }
}

export async function getTransientMatchRecommendations(careerText, intake = {}, limit = 3) {
  const matchingProfile = buildStructuredCareerProfile(careerText, intake).matchingProfile
  const [companies, history, liveJobs] = await Promise.all([
    neonHelper.query(`SELECT company_id, name, description, industry, tags, logo, cached_logo_url FROM trusted_companies WHERE status = 'active'`),
    neonHelper.query(`SELECT * FROM ${HISTORY_TABLE} ORDER BY last_seen_at DESC`),
    loadTrustedLiveJobs()
  ])
  const grouped = mergeCompanyEvidence(history, liveJobs)
  return (companies || [])
    .map((company) => computeCompanyMatch(matchingProfile, company, grouped.get(String(company.company_id)) || []))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'zh-CN'))
    .slice(0, Math.max(1, Math.min(5, Number(limit) || 3)))
}

export async function getMatchFeed({ user, profileRow, isMember = false }) {
  if (!profileRow) return { profile: { exists: false }, recommendations: [], followedUpdates: [], meta: { source: 'cached', hasNewData: false, poolExhausted: false, generatedAt: new Date().toISOString(), algorithmVersion: MINI_MATCH_ALGORITHM_VERSION } }
  const userId = String(user?.user_id || '').trim()
  if (!userId) throw new Error('Match user identity is missing')
  await neonHelper.query(
    `DELETE FROM ${RUNS_TABLE} WHERE user_id = $1 AND generated_at < NOW() - INTERVAL '7 days'`,
    [userId]
  )
  const [cached, recentRuns] = await Promise.all([
    neonHelper.query(
      `SELECT recommendations, catalog_version, generated_at FROM ${RUNS_TABLE}
        WHERE user_id = $1 AND profile_id = $2 AND profile_version = $3 AND algorithm_version = $4
          AND generated_at >= NOW() - INTERVAL '24 hours'
        ORDER BY generated_at DESC LIMIT 1`,
      [userId, profileRow.profile_id, profileRow.version, MINI_MATCH_ALGORITHM_VERSION]
    ),
    neonHelper.query(
      `SELECT recommendations, generated_at FROM ${RUNS_TABLE}
        WHERE user_id = $1 AND profile_id = $2 AND profile_version = $3
          AND generated_at >= NOW() - INTERVAL '7 days'
        ORDER BY generated_at DESC`,
      [userId, profileRow.profile_id, profileRow.version]
    )
  ])
  const limit = isMember ? 5 : 3
  const cachedRecommendations = recommendationItems(cached?.[0]?.recommendations)
  const hasRecentMatch = (recentRuns || []).some((item) => recommendationItems(item?.recommendations).length > 0)
  // An empty daily cache can become stale when a previous run had matches or
  // when trusted jobs were refreshed. Recompute in that case so a transient
  // empty result cannot hide newly available companies for the whole day.
  let run = cached?.[0] && (cachedRecommendations.length > 0 || !hasRecentMatch)
    ? { recommendations: cachedRecommendations, catalogVersion: cached[0].catalog_version, source: 'cached', generatedAt: cached[0].generated_at, fallbackUsed: String(cached[0].catalog_version || '').endsWith(':carry') }
    : null
  if (!run) run = await loadRecommendations(profileRow, userId, { recentRuns, limit })

  const [follows, exposures, updates, activeCompanies] = await Promise.all([
    neonHelper.query(`SELECT company_id, status, in_app_enabled, wechat_enabled FROM ${FOLLOWS_TABLE} WHERE user_id = $1 AND status = 'active'`, [userId]),
    neonHelper.query(`SELECT company_id, show_count, last_shown_at, last_opened_at, dismissed_at FROM ${EXPOSURES_TABLE} WHERE user_id = $1`, [userId]),
    neonHelper.query(
      `SELECT inbox.inbox_id, inbox.status, events.company_id, companies.name AS company_name,
              events.event_type, events.occurred_at, events.has_public_opportunity
         FROM ${INBOX_TABLE} inbox
         JOIN ${EVENTS_TABLE} events ON events.event_id = inbox.event_id
         JOIN trusted_companies companies ON companies.company_id = events.company_id
        WHERE inbox.user_id = $1 AND inbox.status = 'unread'
        ORDER BY events.occurred_at DESC LIMIT 20`,
      [userId]
    ),
    neonHelper.query(`SELECT company_id FROM trusted_companies WHERE status = 'active'`)
  ])
  const followIds = new Set((follows || []).map((row) => String(row.company_id)))
  const exposureMap = new Map((exposures || []).map((row) => [String(row.company_id), row]))
  const updateIds = new Set((updates || []).map((row) => String(row.company_id)))
  const retainedRecommendations = collectRecentMatchRecommendations({
    runs: [{ recommendations: run.recommendations, generatedAt: run.generatedAt }, ...(recentRuns || [])],
    activeCompanyIds: (activeCompanies || []).map((company) => company.company_id)
  })
  const pool = retainedRecommendations.map((item) => {
    const publicItem = { ...(item || {}) }
    delete publicItem.score
    delete publicItem.latestEvidenceAt
    delete publicItem.firstMatchedAt
    return {
    ...publicItem,
    isFollowed: followIds.has(String(item.companyId)),
    hasUpdate: updateIds.has(String(item.companyId))
    }
  })
  const chosen = pool.filter((item) => !exposureMap.get(String(item.companyId))?.dismissed_at)
  return {
    profile: {
      exists: true,
      completeness: Number(profileRow.profile_completeness || 0),
      retentionPolicy: profileRow.retention_policy,
      expiresAt: profileRow.expires_at || null,
      updatedAt: profileRow.updated_at || null
    },
    recommendations: chosen,
    followedUpdates: updates || [],
    meta: {
      source: run.source,
      hasNewData: chosen.some((item) => item.hasUpdate),
      poolExhausted: chosen.length < limit && pool.length > 0,
      generatedAt: run.generatedAt,
      algorithmVersion: MINI_MATCH_ALGORITHM_VERSION,
      fallbackUsed: Boolean(run.fallbackUsed),
      historyWindowDays: 7,
      dailyLimit: limit,
      emptyReason: chosen.length ? null : Number(profileRow.profile_completeness || 0) < 0.7 ? 'profile_incomplete' : 'no_supported_match'
    }
  }
}

export async function setCompanyFollow({ user, companyId, active = true, isMember = false }) {
  const id = String(companyId || '').trim()
  if (!id) throw Object.assign(new Error('企业参数无效'), { statusCode: 400 })
  const company = await neonHelper.query(`SELECT company_id, name FROM trusted_companies WHERE company_id = $1 LIMIT 1`, [id])
  if (!company?.[0]) throw Object.assign(new Error('企业不存在'), { statusCode: 404 })
  if (active) {
    const allowed = await neonHelper.query(
      `SELECT 1
        WHERE EXISTS (
          SELECT 1 FROM ${FOLLOWS_TABLE} WHERE user_id = $2 AND company_id = $1 AND status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM trusted_companies WHERE company_id = $1 AND status = 'active'
        )
        LIMIT 1`,
      [id, user.user_id]
    )
    if (!allowed?.[0]) {
      throw Object.assign(new Error('该企业当前暂不可订阅'), {
        statusCode: 403,
        code: 'COMPANY_NOT_AVAILABLE'
      })
    }
  }
  const sql = neonHelper.getClient()
  if (!sql?.transaction) throw new Error('Subscription transaction is unavailable')
  // The lock is a separate statement: under READ COMMITTED the following count
  // sees the preceding writer's commit, including when two devices race for #5.
  const [, rows] = await sql.transaction([
    sql.query('SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE', [user.user_id]),
    sql.query(
     `INSERT INTO ${FOLLOWS_TABLE} (
       user_id, company_id, status, in_app_enabled,
       wechat_enabled, wechat_template_status, updated_at
     ) SELECT $1::varchar, $2::varchar, $3::varchar, ($3::varchar = 'active'), FALSE, 'not_requested', NOW()
       WHERE $4::boolean OR $3::varchar = 'inactive'
          OR EXISTS (SELECT 1 FROM ${FOLLOWS_TABLE} WHERE user_id = $1 AND company_id = $2 AND status = 'active')
          OR (SELECT COUNT(*) FROM ${FOLLOWS_TABLE} WHERE user_id = $1 AND status = 'active') < 5
     ON CONFLICT (user_id, company_id) DO UPDATE SET
       status = EXCLUDED.status,
       in_app_enabled = (EXCLUDED.status = 'active'),
       wechat_enabled = CASE
         WHEN EXCLUDED.status = 'inactive' OR ${FOLLOWS_TABLE}.status = 'inactive' THEN FALSE
         ELSE ${FOLLOWS_TABLE}.wechat_enabled
       END,
       wechat_template_status = CASE
         WHEN EXCLUDED.status = 'inactive' OR ${FOLLOWS_TABLE}.status = 'inactive' THEN 'not_requested'
         ELSE ${FOLLOWS_TABLE}.wechat_template_status
       END,
       updated_at = NOW()
     RETURNING company_id`,
    [user.user_id, id, active ? 'active' : 'inactive', isMember]
    )
  ], { isolationLevel: 'ReadCommitted' })
  if (!rows?.length) throw Object.assign(new Error('免费版最多订阅 5 家企业，开通会员可订阅更多'), {
    statusCode: 403, code: 'COMPANY_FOLLOW_LIMIT_REACHED'
  })
  return { success: true, companyId: id, followed: active }
}

export async function listCompanyFollows(user) {
  const rows = await neonHelper.query(
    `SELECT follows.company_id, follows.status, follows.in_app_enabled, follows.wechat_enabled,
            follows.wechat_template_status, follows.created_at AS followed_at,
            companies.name, companies.industry, companies.cached_logo_url,
            COALESCE(hiring.open_job_count, 0) AS open_job_count,
            hiring.open_role_categories
       FROM ${FOLLOWS_TABLE} follows
       JOIN trusted_companies companies ON companies.company_id = follows.company_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS open_job_count,
                ARRAY(
                  SELECT category_rollup.category
                    FROM (
                      SELECT BTRIM(history.category) AS category,
                             COUNT(*)::int AS job_count,
                             MAX(history.last_seen_at) AS latest_seen
                        FROM company_job_history history
                       WHERE history.company_id = follows.company_id
                         AND history.closed_at IS NULL
                         AND history.is_public_opportunity IS TRUE
                         AND NULLIF(BTRIM(history.category), '') IS NOT NULL
                       GROUP BY BTRIM(history.category)
                       ORDER BY latest_seen DESC NULLS LAST, job_count DESC, category ASC
                       LIMIT 12
                    ) category_rollup
                ) AS open_role_categories
           FROM company_job_history open_jobs
          WHERE open_jobs.company_id = follows.company_id
            AND open_jobs.closed_at IS NULL
            AND open_jobs.is_public_opportunity IS TRUE
       ) hiring ON TRUE
      WHERE follows.user_id = $1
        AND follows.status = 'active'
      ORDER BY follows.updated_at DESC`,
    [user.user_id]
  )
  return {
    success: true,
    follows: (rows || []).map((row) => {
      const companyId = String(row.company_id || '')
      const logoFileId = String(row.cached_logo_url || '').trim()
      return {
        company_id: companyId,
        name: String(row.name || ''),
        industry: String(row.industry || ''),
        logoFileId: /^cloud:\/\/[A-Za-z0-9_.@/-]+$/.test(logoFileId) ? logoFileId : '',
        _logoSourcePath: `/api/company-assets?companyId=${encodeURIComponent(companyId)}&type=logo`,
        openJobCount: Number(row.open_job_count || 0),
        openRoleCategories: normalizeOpenRoleCategories(row.open_role_categories, 6),
        followedAt: row.followed_at || null,
        wechat_enabled: Boolean(row.wechat_enabled),
        wechat_template_status: String(row.wechat_template_status || 'not_requested')
      }
    })
  }
}

export async function setFollowNotifications({ user, companyId, enabled, templateStatus = 'not_requested', isMember = false }) {
  const safeStatus = ['not_requested', 'accepted', 'rejected', 'unavailable'].includes(templateStatus)
    ? templateStatus
    : 'not_requested'
  if (enabled && safeStatus !== 'accepted') {
    throw Object.assign(new Error('请先完成微信订阅消息授权'), {
      statusCode: 403,
      code: 'SUBSCRIBE_AUTH_REQUIRED'
    })
  }
  const sql = neonHelper.getClient()
  if (!sql?.transaction) throw new Error('Subscription transaction is unavailable')
  const [, rows] = await sql.transaction([
    sql.query('SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE', [user.user_id]),
    sql.query(
    `UPDATE ${FOLLOWS_TABLE} SET wechat_enabled = $1, wechat_template_status = $2,
      authorization_id = gen_random_uuid(), authorized_at = clock_timestamp(), updated_at = NOW()
      WHERE user_id = $3 AND company_id = $4 AND status = 'active'
        AND (NOT $1::boolean OR $5::boolean
          OR (wechat_enabled = TRUE AND wechat_template_status = 'accepted')
          OR (SELECT COUNT(*) FROM ${FOLLOWS_TABLE}
               WHERE user_id = $3 AND status = 'active'
                 AND wechat_enabled = TRUE AND wechat_template_status = 'accepted') < 5)
      RETURNING company_id`,
    [Boolean(enabled), safeStatus, user.user_id, String(companyId), isMember]
    )
  ], { isolationLevel: 'ReadCommitted' })
  if (!rows?.[0]) {
    const followed = await neonHelper.query(
      `SELECT 1 FROM ${FOLLOWS_TABLE} WHERE user_id = $1 AND company_id = $2 AND status = 'active'`,
      [user.user_id, String(companyId)]
    )
    if (enabled && followed?.length) throw Object.assign(new Error('免费版最多开启 5 家企业的微信提醒'), {
      statusCode: 403, code: 'COMPANY_REMINDER_LIMIT_REACHED'
    })
    throw Object.assign(new Error('请先订阅企业更新'), {
      statusCode: 403,
      code: 'SUBSCRIBE_AUTH_REQUIRED'
    })
  }
  return { success: true, enabled: Boolean(enabled), templateStatus: safeStatus }
}

export async function recordMatchFeedback({ user, companyId, action }) {
  const safeAction = ['opened', 'dismissed', 'seen'].includes(action) ? action : ''
  if (!safeAction) throw Object.assign(new Error('反馈类型无效'), { statusCode: 400 })
  await neonHelper.query(
    `INSERT INTO ${EXPOSURES_TABLE} (user_id, company_id, show_count, last_opened_at, dismissed_at, updated_at)
     VALUES ($1, $2, 0, CASE WHEN $3 = 'opened' THEN NOW() ELSE NULL END, CASE WHEN $3 = 'dismissed' THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (user_id, company_id) DO UPDATE SET
       last_opened_at = CASE WHEN $3 = 'opened' THEN NOW() ELSE ${EXPOSURES_TABLE}.last_opened_at END,
       dismissed_at = CASE WHEN $3 = 'dismissed' THEN NOW() ELSE ${EXPOSURES_TABLE}.dismissed_at END,
       updated_at = NOW()`,
    [user.user_id, companyId, safeAction]
  )
  return { success: true }
}

export async function markMatchUpdatesRead(user, inboxIds = []) {
  const ids = [...new Set((Array.isArray(inboxIds) ? inboxIds : []).map((id) => String(id).trim()).filter(Boolean))].slice(0, 50)
  if (!ids.length) return { success: true, updated: 0 }
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(',')
  const rows = await neonHelper.query(`UPDATE ${INBOX_TABLE} SET status = 'read', read_at = NOW() WHERE user_id = $1 AND inbox_id IN (${placeholders}) RETURNING inbox_id`, [user.user_id, ...ids])
  return { success: true, updated: Array.isArray(rows) ? rows.length : 0 }
}

export function selectBestPublicOpportunity(profile, jobs = []) {
  const roleFamilies = new Set(profile?.roleFamilies || [])
  return jobs.map((job) => {
    const feature = jobHistoryFeatures(job)
    const score = scoreJobForUserProfile(profile, feature)
    const direct = feature.roleFamilies?.some((family) => roleFamilies.has(family)) ||
      (Number(score?.breakdown?.titleMatch || 0) >= 60 && Number(score?.breakdown?.roleTypeMatch || 0) >= 72)
    return { job, score: direct ? scoreCompanyJobFit(score) : 0 }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0]?.job || null
}

export async function createApplyTicket({ user, companyId }) {
  const [profileRows, rows] = await Promise.all([
    neonHelper.query(
      `SELECT * FROM mini_career_profiles
        WHERE user_id = $1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1`,
      [user.user_id]
    ),
    neonHelper.query(
    `SELECT * FROM jobs
      WHERE (company_id = $1 OR (company_id IS NULL AND EXISTS (SELECT 1 FROM trusted_companies c WHERE c.company_id = $1 AND LOWER(BTRIM(c.name)) = LOWER(BTRIM(jobs.company)))))
        AND status = 'active' AND is_approved = TRUE AND NULLIF(BTRIM(url), '') IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST LIMIT 50`,
    [String(companyId)]
    )
  ])
  if (!profileRows?.[0] || !rows?.length) throw Object.assign(new Error('公开申请入口暂不可用'), { statusCode: 404, code: 'PUBLIC_OPPORTUNITY_UNAVAILABLE' })
  const profile = await loadCandidateProfile(profileRows[0])
  const selected = selectBestPublicOpportunity(profile, rows)
  if (!selected) throw Object.assign(new Error('暂时没有与你方向相关的公开机会'), { statusCode: 404, code: 'PUBLIC_OPPORTUNITY_UNAVAILABLE' })
  const rawToken = crypto.randomBytes(32).toString('base64url')
  await neonHelper.query(`INSERT INTO ${TICKETS_TABLE} (token_hash, user_id, job_id, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '60 seconds')`, [hash(rawToken), user.user_id, selected.job_id])
  const origin = String(process.env.MINI_WEB_ENTRY_ORIGIN || 'https://www.haigooremote.com').replace(/\/$/, '')
  return { success: true, url: `${origin}/mini-entry?ticket=${encodeURIComponent(rawToken)}&job=${encodeURIComponent(selected.job_id)}`, expiresInSeconds: 60 }
}

export { hash as hashMatchToken, jobHistoryFeatures, roleFamiliesForText }
