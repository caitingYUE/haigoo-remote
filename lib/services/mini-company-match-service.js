import crypto from 'node:crypto'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { extractStructuredResume } from './resume-structure-extractor.js'
import { buildMatchingProfile, scoreJobForUserProfile } from './matching-engine.js'

export const MINI_MATCH_ALGORITHM_VERSION = 'company-match-v2'
const HISTORY_TABLE = 'company_job_history'
const COMPANY_PROFILES_TABLE = 'company_hiring_profiles'
const RUNS_TABLE = 'mini_match_recommendation_runs'
const EXPOSURES_TABLE = 'mini_match_exposures'
const FOLLOWS_TABLE = 'mini_company_follows'
const EVENTS_TABLE = 'mini_company_update_events'
const INBOX_TABLE = 'mini_company_update_inbox'
const TICKETS_TABLE = 'mini_web_session_tickets'
let wechatAccessTokenCache = { token: '', expiresAt: 0 }
const wechatTemplateFieldsCache = new Map()

const ROLE_FAMILY_ALIASES = {
  product: ['产品', 'product', 'pm', 'product manager', '产品经理', '产品运营', '产品策划'],
  project: ['项目', 'project', 'program', '项目经理', 'program manager'],
  engineering: ['研发', '工程', 'software', 'developer', 'engineer', '开发', '技术'],
  design: ['设计', 'design', 'ux', 'ui', '视觉', '交互'],
  data: ['数据', 'data', 'analytics', '分析', 'machine learning', '机器学习'],
  marketing: ['市场', 'marketing', '品牌', 'growth', '增长', '内容营销'],
  sales: ['销售', 'sales', 'business development', '商务', '客户成功'],
  operations: ['运营', 'operations', 'community', '社群', '用户运营'],
  research: ['研究', 'research', '用户研究', 'ux research'],
  finance: ['财务', 'finance', 'accounting', '会计'],
  hr: ['人力', 'hr', 'human resources', '招聘', '人才']
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
    job_id: row.source_job_id || row.history_id,
    jobId: row.source_job_id || row.history_id,
    title: row.title || '',
    description: row.description || '',
    category: row.category || '',
    industry: row.industry || '',
    experience_level: row.experience_level || '',
    location: row.location || '',
    timezone: row.timezone || '',
    roleFamilies: unique([...(row.role_families || []), ...structured.roleFamilies, ...roleFamiliesForText(`${row.title} ${row.category}`)], 12),
    skills: unique([...(row.normalized_skills || []), ...structured.skills], 40)
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

export async function archiveJobSnapshot(job, { closed = false } = {}) {
  if (!neonHelper.isConfigured || !job) return null
  const companyId = String(job.companyId || job.company_id || '').trim()
  if (!companyId) return null
  const sourceJobId = String(job.id || job.job_id || '').trim()
  const sourceUrl = String(job.url || '').trim() || sourceJobId
  if (!sourceJobId || !sourceUrl) return null
  const structured = extractStructuredResume(`${job.title || ''}\n${job.category || ''}\n${job.description || ''}`)
  const roleFamilies = unique([...structured.roleFamilies, ...roleFamiliesForText(`${job.title} ${job.category}`)], 12)
  const skills = unique([...(Array.isArray(job.tags) ? job.tags : []), ...(Array.isArray(job.skills) ? job.skills : []), ...structured.skills], 40)
  const payloadHash = hash({ title: job.title, description: job.description, category: job.category, url: sourceUrl, location: job.location, status: job.status, approved: job.isApproved ?? job.is_approved })
  const publicOpportunity = String(job.status || '').toLowerCase() === 'active' && Boolean(job.isApproved ?? job.is_approved) && Boolean(job.url || job.sourceUrl)
  const rows = await neonHelper.query(
    `INSERT INTO ${HISTORY_TABLE} (
       company_id, source_job_id, source_url_hash, title, description, category,
       role_families, normalized_skills, industry, experience_level, location, timezone,
       first_seen_at, last_seen_at, source_published_at, closed_at, payload_hash,
       evidence_quality, is_public_opportunity, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12,
       COALESCE($13::timestamptz, NOW()), NOW(), $13::timestamptz, $14::timestamptz,
       $15, $16, $17, NOW())
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
     RETURNING history_id, payload_hash`,
    [companyId, sourceJobId, hash(sourceUrl), String(job.title || '').trim() || '未命名岗位', String(job.description || ''), String(job.category || ''), JSON.stringify(roleFamilies), JSON.stringify(skills), String(job.industry || ''), String(job.experienceLevel || job.experience_level || ''), String(job.location || job.region || ''), String(job.timezone || ''), job.publishedAt || job.published_at || null, closed ? new Date().toISOString() : null, payloadHash, publicOpportunity ? 0.9 : 0.65, publicOpportunity]
  )
  return rows?.[0] || null
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

export async function recordCompanyUpdateEvent({ companyId, eventType = 'job_added', job = null }) {
  const safeType = ['job_added', 'job_reopened', 'company_updated'].includes(eventType) ? eventType : 'company_updated'
  const sourceJobId = String(job?.id || job?.job_id || '').trim() || null
  const structured = job ? extractStructuredResume(`${job.title || ''}\n${job.category || ''}\n${job.description || ''}`) : { roleFamilies: [] }
  const roleFamilies = unique([...(structured.roleFamilies || []), ...roleFamiliesForText(`${job?.title || ''} ${job?.category || ''}`)], 12)
  const publicOpportunity = Boolean(job && String(job.status || 'active') === 'active' && (job.isApproved ?? job.is_approved ?? true) && (job.url || job.sourceUrl))
  const eventHash = hash({ companyId, safeType, sourceJobId, payload: job ? hash({ title: job.title, url: job.url, description: job.description }) : '' })
  const rows = await neonHelper.query(
    `INSERT INTO ${EVENTS_TABLE} (company_id, event_type, event_hash, role_families, has_public_opportunity, source_job_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (event_hash) DO NOTHING RETURNING event_id`,
    [companyId, safeType, eventHash, JSON.stringify(roleFamilies), publicOpportunity, sourceJobId]
  )
  const eventId = rows?.[0]?.event_id
  if (!eventId) return { created: false }
  await neonHelper.query(
    `INSERT INTO ${INBOX_TABLE} (user_id, event_id, notification_status)
     SELECT user_id, $1, CASE WHEN wechat_enabled THEN 'pending' ELSE 'not_requested' END
       FROM ${FOLLOWS_TABLE} WHERE company_id = $2 AND status = 'active' AND in_app_enabled = TRUE
     ON CONFLICT (user_id, event_id) DO NOTHING`,
    [eventId, companyId]
  )
  try {
    await deliverCompanyUpdateNotifications(eventId)
  } catch (error) {
    console.warn('[mini-match] WeChat company update delivery deferred', error?.message || error)
  }
  return { created: true, eventId }
}

async function getWechatAccessToken() {
  if (wechatAccessTokenCache.token && wechatAccessTokenCache.expiresAt > Date.now() + 60_000) return wechatAccessTokenCache.token
  const appid = String(process.env.WECHAT_MINI_APP_ID || '').trim()
  const secret = String(process.env.WECHAT_MINI_APP_SECRET || '').trim()
  if (!appid || !secret) return ''
  const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new Error(`微信访问凭证获取失败 (${result.errcode || response.status})`)
  wechatAccessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in || 7200) - 120) * 1000
  }
  return result.access_token
}

async function getWechatTemplateFields(accessToken, templateId) {
  const cached = wechatTemplateFieldsCache.get(templateId)
  if (cached) return cached
  const response = await fetch(`https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate?access_token=${encodeURIComponent(accessToken)}`, {
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json()
  const template = (result.data || []).find((item) => item.priTmplId === templateId)
  if (!response.ok || !template) throw new Error(`微信订阅模板不可用 (${result.errcode || response.status})`)
  const fields = [...String(template.content || '').matchAll(/([^{}\n]+)\{\{([A-Za-z]+\d+)\.DATA\}\}/g)]
    .map((match) => ({ label: match[1].replace(/[：:\s]+$/g, '').trim(), key: match[2] }))
  if (!fields.length) throw new Error('微信订阅模板没有可用字段')
  wechatTemplateFieldsCache.set(templateId, fields)
  return fields
}

function wechatTemplateFieldValue(field, row) {
  const label = field.label
  const key = field.key.toLowerCase()
  const occurredAt = new Date(row.occurred_at || Date.now())
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt).replace(/\//g, '-')
  let value = '请进入小程序查看'
  if (/企业.*名称|招聘企业/.test(label)) value = row.company_name || 'Haigoo Remote'
  else if (/职位|岗位/.test(label)) value = '与你方向相关的公开机会'
  else if (/行业/.test(label)) value = row.industry || '远程工作'
  else if (/地点|地区|位置/.test(label)) value = '远程/以页面为准'
  else if (/工作类型|职位类型|用工类型/.test(label)) value = '远程机会'
  else if (/时间|日期/.test(label) || key.startsWith('time') || key.startsWith('date')) value = time
  else if (/方案/.test(label)) value = '海狗远程企业机会'
  if (key.startsWith('thing')) value = String(value).slice(0, 20)
  return { value }
}

async function deliverCompanyUpdateNotifications(eventId) {
  const templateId = String(process.env.WECHAT_MINI_COMPANY_UPDATE_TEMPLATE_ID || '').trim()
  if (!templateId) return { sent: 0, skipped: true }
  const accessToken = await getWechatAccessToken()
  if (!accessToken) return { sent: 0, skipped: true }
  const rows = await neonHelper.query(
    `SELECT inbox.inbox_id, inbox.user_id, identities.openid, events.company_id,
            events.occurred_at, companies.name AS company_name, companies.industry
       FROM ${INBOX_TABLE} inbox
       JOIN ${EVENTS_TABLE} events ON events.event_id = inbox.event_id
       JOIN trusted_companies companies ON companies.company_id = events.company_id
       JOIN ${FOLLOWS_TABLE} follows ON follows.user_id = inbox.user_id AND follows.company_id = events.company_id
       JOIN mini_wechat_identities identities ON identities.user_id = inbox.user_id AND identities.app_id = $2
       JOIN mini_career_profiles profiles ON profiles.user_id = inbox.user_id
      WHERE inbox.event_id = $1 AND inbox.notification_status = 'pending'
        AND events.has_public_opportunity = TRUE AND follows.status = 'active'
        AND follows.wechat_enabled = TRUE AND follows.wechat_template_status = 'accepted'
        AND profiles.deleted_at IS NULL AND (profiles.expires_at IS NULL OR profiles.expires_at > NOW())
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(events.role_families, '[]'::jsonb)) AS event_role(value)
           WHERE COALESCE(profiles.structured_profile->'roleFamilies', '[]'::jsonb) ? event_role.value
        )
      LIMIT 100`,
    [eventId, String(process.env.WECHAT_MINI_APP_ID || '')]
  )
  if (!rows?.length) return { sent: 0 }
  const fields = await getWechatTemplateFields(accessToken, templateId)
  let sent = 0
  for (const row of rows) {
    let status = 'failed'
    try {
      const data = Object.fromEntries(fields.map((field) => [field.key, wechatTemplateFieldValue(field, row)]))
      const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: row.openid,
          template_id: templateId,
          page: `pages/company-detail/index?id=${encodeURIComponent(row.company_id)}`,
          miniprogram_state: process.env.VERCEL_ENV === 'production' ? 'formal' : 'developer',
          lang: 'zh_CN',
          data
        }),
        signal: AbortSignal.timeout(10_000)
      })
      const result = await response.json()
      if (!response.ok || Number(result.errcode || 0) !== 0) throw new Error(`微信订阅消息发送失败 (${result.errcode || response.status})`)
      status = 'sent'
      sent += 1
    } catch (error) {
      console.warn('[mini-match] WeChat subscription message failed', row.inbox_id, error?.message || error)
    }
    await neonHelper.query(
      `UPDATE ${INBOX_TABLE} SET notification_status = $1, notified_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE notified_at END
        WHERE inbox_id = $2`,
      [status, row.inbox_id]
    )
    if (status === 'sent') {
      await neonHelper.query(
        `UPDATE ${FOLLOWS_TABLE} SET wechat_enabled = FALSE, wechat_template_status = 'not_requested', updated_at = NOW()
          WHERE user_id = $1 AND company_id = $2`,
        [row.user_id, row.company_id]
      )
    }
  }
  return { sent }
}

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
    industry: String(company.industry || '其他'),
    description: String(company.description || '').trim(),
    logoFileId: String(company.cached_logo_url || '').startsWith('cloud://') ? String(company.cached_logo_url) : '',
    _logoSourcePath: String(company.cached_logo_url || '').startsWith('/api/company-assets?') ? company.cached_logo_url : '',
    fitBand: band,
    reasons: reasons.slice(0, 2),
    evidenceSummary: `${features.length} 条历史招聘证据，最近更新于 ${new Date(features[0].last_seen_at || Date.now()).toLocaleDateString('zh-CN')}`,
    hasPublicOpportunity: currentOpportunity,
    opportunity: bestPublicOpportunity ? {
      jobId: String(bestPublicOpportunity.jobId || bestPublicOpportunity.job_id || ''),
      title: String(bestPublicOpportunity.title || '相关公开岗位')
    } : null,
    score: Math.round(total),
    latestEvidenceAt: features[0].last_seen_at || null
  }
}

async function getCatalogVersion() {
  const rows = await neonHelper.query(`SELECT COUNT(*)::int AS count, COALESCE(MAX(updated_at), '1970-01-01T00:00:00Z'::timestamptz) AS updated_at FROM ${COMPANY_PROFILES_TABLE}`)
  return `${Number(rows?.[0]?.count || 0)}:${String(rows?.[0]?.updated_at || '')}`
}

async function loadRecommendations(profileRow, userId, { excludedCompanyIds = [], limit = 12 } = {}) {
  // The authenticated user id is intentionally passed into loadRecommendations(profileRow, userId).
  const matchingProfile = await loadCandidateProfile(profileRow)
  const [companies, history, catalogVersion] = await Promise.all([
    neonHelper.query(`SELECT company_id, name, description, industry, tags, cached_logo_url FROM trusted_companies WHERE status = 'active'`),
    neonHelper.query(`SELECT * FROM ${HISTORY_TABLE} ORDER BY last_seen_at DESC`),
    getCatalogVersion()
  ])
  const grouped = new Map()
  for (const row of history || []) {
    if (!grouped.has(String(row.company_id))) grouped.set(String(row.company_id), [])
    grouped.get(String(row.company_id)).push(row)
  }
  const excluded = new Set((excludedCompanyIds || []).map((id) => String(id)))
  const recommendations = (companies || [])
    .map((company) => computeCompanyMatch(matchingProfile, company, grouped.get(String(company.company_id)) || []))
    .filter(Boolean)
    .filter((company) => !excluded.has(String(company.companyId)))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'zh-CN'))
    .slice(0, Math.max(1, Math.min(12, Number(limit) || 12)))
  const dailyCatalogVersion = `${catalogVersion}:daily:${new Date().toISOString().slice(0, 10)}`
  const inputHash = hash({ profile: profileRow.profile_hash, catalogVersion, excluded: [...excluded].sort(), algorithm: MINI_MATCH_ALGORITHM_VERSION })
  await neonHelper.query(
    `INSERT INTO ${RUNS_TABLE} (profile_id, user_id, profile_version, catalog_version, algorithm_version, input_hash, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (user_id, profile_version, catalog_version, algorithm_version) DO UPDATE SET
       recommendations = EXCLUDED.recommendations, input_hash = EXCLUDED.input_hash, generated_at = NOW()
     RETURNING run_id, generated_at`,
    [profileRow.profile_id, userId, profileRow.version, dailyCatalogVersion, MINI_MATCH_ALGORITHM_VERSION, inputHash, JSON.stringify(recommendations)]
  )
  await neonHelper.query(`UPDATE mini_career_profiles SET last_match_at = NOW() WHERE profile_id = $1`, [profileRow.profile_id])
  return { recommendations, catalogVersion: dailyCatalogVersion, source: 'recomputed', generatedAt: new Date().toISOString() }
}

export async function getTransientMatchRecommendations(careerText, intake = {}, limit = 3) {
  const matchingProfile = buildStructuredCareerProfile(careerText, intake).matchingProfile
  const [companies, history] = await Promise.all([
    neonHelper.query(`SELECT company_id, name, description, industry, tags, cached_logo_url FROM trusted_companies WHERE status = 'active'`),
    neonHelper.query(`SELECT * FROM ${HISTORY_TABLE} ORDER BY last_seen_at DESC`)
  ])
  const grouped = new Map()
  for (const row of history || []) {
    if (!grouped.has(String(row.company_id))) grouped.set(String(row.company_id), [])
    grouped.get(String(row.company_id)).push(row)
  }
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
  const cached = await neonHelper.query(
    `SELECT recommendations, catalog_version, generated_at FROM ${RUNS_TABLE}
      WHERE user_id = $1 AND profile_id = $2 AND profile_version = $3 AND algorithm_version = $4
        AND generated_at >= NOW() - INTERVAL '24 hours'
      ORDER BY generated_at DESC LIMIT 1`,
    [userId, profileRow.profile_id, profileRow.version, MINI_MATCH_ALGORITHM_VERSION]
  )
  let run = cached?.[0] ? { recommendations: cached[0].recommendations || [], catalogVersion: cached[0].catalog_version, source: 'cached', generatedAt: cached[0].generated_at } : null
  const limit = isMember ? 5 : 3
  if (!run) {
    const recentRuns = await neonHelper.query(
      `SELECT recommendations FROM ${RUNS_TABLE}
        WHERE user_id = $1 AND profile_id = $2 AND profile_version = $3 AND algorithm_version = $4
          AND generated_at >= NOW() - INTERVAL '7 days'`,
      [userId, profileRow.profile_id, profileRow.version, MINI_MATCH_ALGORITHM_VERSION]
    )
    const excludedCompanyIds = (recentRuns || []).flatMap((row) => {
      const items = Array.isArray(row.recommendations) ? row.recommendations : []
      return items.map((item) => item?.companyId).filter(Boolean)
    })
    run = await loadRecommendations(profileRow, userId, { excludedCompanyIds, limit })
  }

  const [follows, exposures, updates] = await Promise.all([
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
    )
  ])
  const followIds = new Set((follows || []).map((row) => String(row.company_id)))
  const exposureMap = new Map((exposures || []).map((row) => [String(row.company_id), row]))
  const updateIds = new Set((updates || []).map((row) => String(row.company_id)))
  const pool = (Array.isArray(run.recommendations) ? run.recommendations : []).map((item) => {
    const publicItem = { ...(item || {}) }
    delete publicItem.score
    delete publicItem.latestEvidenceAt
    return {
    ...publicItem,
    isFollowed: followIds.has(String(item.companyId)),
    hasUpdate: updateIds.has(String(item.companyId))
    }
  })
  const chosen = pool.filter((item) => !exposureMap.get(String(item.companyId))?.dismissed_at).slice(0, limit)
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
      algorithmVersion: MINI_MATCH_ALGORITHM_VERSION
    }
  }
}

export async function setCompanyFollow({ user, companyId, active = true, isMember = false }) {
  const id = String(companyId || '').trim()
  if (!id) throw Object.assign(new Error('企业参数无效'), { statusCode: 400 })
  const company = await neonHelper.query(`SELECT company_id, name FROM trusted_companies WHERE company_id = $1 AND status = 'active' LIMIT 1`, [id])
  if (!company?.[0]) throw Object.assign(new Error('企业不存在'), { statusCode: 404 })
  if (active && !isMember) {
    const countRows = await neonHelper.query(`SELECT COUNT(*)::int AS count FROM ${FOLLOWS_TABLE} WHERE user_id = $1 AND status = 'active'`, [user.user_id])
    if (Number(countRows?.[0]?.count || 0) >= 3) throw Object.assign(new Error('免费用户最多关注 3 家企业'), { statusCode: 403, code: 'FOLLOW_LIMIT_REACHED' })
  }
  await neonHelper.query(
    `INSERT INTO ${FOLLOWS_TABLE} (user_id, company_id, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, company_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
    [user.user_id, id, active ? 'active' : 'inactive']
  )
  return { success: true, companyId: id, followed: active }
}

export async function listCompanyFollows(user) {
  const rows = await neonHelper.query(
    `SELECT follows.company_id, follows.status, follows.in_app_enabled, follows.wechat_enabled,
            follows.wechat_template_status, follows.created_at, companies.name, companies.industry
       FROM ${FOLLOWS_TABLE} follows JOIN trusted_companies companies ON companies.company_id = follows.company_id
      WHERE follows.user_id = $1 AND follows.status = 'active' ORDER BY follows.updated_at DESC`,
    [user.user_id]
  )
  return { success: true, follows: rows || [] }
}

export async function setFollowNotifications({ user, companyId, enabled, templateStatus = 'not_requested' }) {
  await neonHelper.query(
    `UPDATE ${FOLLOWS_TABLE} SET wechat_enabled = $1, wechat_template_status = $2, updated_at = NOW()
      WHERE user_id = $3 AND company_id = $4 AND status = 'active'`,
    [Boolean(enabled), String(templateStatus || 'not_requested'), user.user_id, String(companyId)]
  )
  return { success: true, enabled: Boolean(enabled), templateStatus }
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
  const rows = await neonHelper.query(`UPDATE ${INBOX_TABLE} SET status = 'read', read_at = NOW() WHERE user_id = $1 AND inbox_id IN (${placeholders})`, [user.user_id, ...ids])
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
