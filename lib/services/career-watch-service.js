import neonHelper from '../../server-utils/dal/neon-helper.js'
import { JOB_CATEGORY_OPTIONS } from '../shared/job-categories.js'
import { roleFamiliesForText } from './mini-company-match-service.js'

export const CAREER_WATCH_ROLE_FAMILIES = [
  'product', 'project', 'engineering', 'design', 'data', 'marketing',
  'sales', 'operations', 'research', 'finance', 'hr'
]

export const CAREER_WATCH_ROLE_LABELS = {
  product: '产品', project: '项目', engineering: '研发', design: '设计', data: '数据',
  marketing: '市场', sales: '销售', operations: '运营', research: '研究', finance: '财务', hr: '人力'
}

const PREFERENCE_KEYS = ['teamSize', 'rating', 'companyAge', 'industry']
const TEAM_SIZES = ['small', 'growth', 'large']
const SOURCE_MODES = ['resume', 'manual', 'mixed']
const TOLERANCE_MODES = ['balanced', 'strict']
const STATUS_VALUES = ['active', 'paused']
const CAREER_ENTITLEMENTS_TABLE = 'mini_career_entitlements'
const FIXED_MATCH_SNAPSHOT_ENABLED = String(process.env.MINI_MATCH_FIXED_SNAPSHOT_ENABLED || '').toLowerCase() === 'true'
const ROLE_OPTION_GROUPS = [
  { key: 'engineering', label: '技术研发', keywords: ['开发', '工程', '算法', '测试', 'QA', '运维', 'SRE', '安全', '架构', '技术', '硬件', '内核', '数据库', '平台', '服务器', '浏览器', '部署', '网络'] },
  { key: 'product', label: '产品与设计', keywords: ['产品', '项目', '设计', 'UI', 'UX', '用户研究'] },
  { key: 'market', label: '市场与销售', keywords: ['市场', '品牌', '营销', '销售', '商务', '客户经理', '增长'] },
  { key: 'operations', label: '运营与客服', keywords: ['运营', '客户服务', '客户支持', '内容', '编辑', '出版', '视频'] },
  { key: 'business', label: '职能与服务', keywords: ['人力', '招聘', '财务', '会计', '法务', '行政', '管理', '采购', '供应链', '医生', '护理', '营养', '健身', '心理'] },
  { key: 'other', label: '数据与其他', keywords: [] }
]

function uniqueStrings(value, limit, allowed = null) {
  const values = Array.isArray(value) ? value : []
  const result = []
  const seen = new Set()
  for (const item of values) {
    const normalized = String(item || '').trim()
    if (!normalized || (allowed && !allowed.includes(normalized)) || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    result.push(normalized)
    if (result.length >= limit) break
  }
  return result
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value.split(/[,，、|/]+/).map((item) => item.trim()).filter(Boolean)
  }
}

function sanitizePreferences(value, activeKeys) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const result = {}
  if (activeKeys.includes('teamSize') && TEAM_SIZES.includes(source.teamSize)) result.teamSize = source.teamSize
  const rating = Number(source.minRating)
  if (activeKeys.includes('rating') && [3.5, 4, 4.5].includes(rating)) result.minRating = rating
  const age = Number(source.minFoundedYears)
  if (activeKeys.includes('companyAge') && [3, 5, 10].includes(age)) result.minFoundedYears = age
  if (activeKeys.includes('industry')) {
    const industries = uniqueStrings(source.industries, 3)
    if (industries.length) result.industries = industries
  }
  return result
}

export function normalizeCareerWatchInput(value = {}) {
  const roleFamilies = uniqueStrings(value.roleFamilies, 5, CAREER_WATCH_ROLE_FAMILIES)
  const activePreferenceKeys = uniqueStrings(value.activePreferenceKeys, 4, PREFERENCE_KEYS)
  const sourceMode = SOURCE_MODES.includes(value.sourceMode) ? value.sourceMode : 'manual'
  const toleranceMode = TOLERANCE_MODES.includes(value.toleranceMode) ? value.toleranceMode : 'balanced'
  const status = STATUS_VALUES.includes(value.status) ? value.status : 'active'
  return {
    sourceMode,
    roleFamilies,
    customRoleTerms: uniqueStrings(value.customRoleTerms, 5),
    companyPreferences: sanitizePreferences(value.companyPreferences, activePreferenceKeys),
    activePreferenceKeys,
    toleranceMode,
    status,
    resumeId: String(value.resumeId || '').trim().slice(0, 255) || null,
    careerProfileId: String(value.careerProfileId || '').trim() || null,
    sourcePlatform: ['mini', 'web', 'legacy_subscription'].includes(value.sourcePlatform) ? value.sourcePlatform : 'web'
  }
}

function mapProfile(row) {
  if (!row) return null
  return {
    profileId: row.profile_id,
    userId: row.user_id,
    sourceMode: row.source_mode,
    roleFamilies: parseJsonArray(row.role_families),
    customRoleTerms: parseJsonArray(row.custom_role_terms),
    companyPreferences: row.company_preferences || {},
    activePreferenceKeys: parseJsonArray(row.active_preference_keys),
    toleranceMode: row.tolerance_mode,
    status: row.status,
    resumeId: row.resume_id || null,
    careerProfileId: row.career_profile_id || null,
    sourcePlatform: row.source_platform,
    inAppEnabled: row.in_app_enabled !== false,
    wechatEnabled: Boolean(row.wechat_enabled),
    wechatTemplateStatus: row.wechat_template_status || 'not_requested',
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function careerWatchEntitlements(isMember = false) {
  return {
    isMember: Boolean(isMember),
    maxRoleFamilies: 5,
    maxPreferenceTypes: null,
    maxFollows: isMember ? null : 5,
    refreshHours: isMember ? 6 : null,
    proactiveDigest: Boolean(isMember)
  }
}

export async function getCareerWatchProfile(userId) {
  const rows = await neonHelper.query(
    'SELECT * FROM career_watch_profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  return mapProfile(rows?.[0])
}

export async function getCareerWatchImportSources(userId) {
  const rows = await neonHelper.query(
    `SELECT
       EXISTS (SELECT 1 FROM subscriptions WHERE user_id::text = $1::text AND status = 'active') AS has_subscription,
       EXISTS (SELECT 1 FROM resumes WHERE user_id = $1) AS has_resume,
       EXISTS (SELECT 1 FROM mini_career_profiles WHERE user_id = $1 AND deleted_at IS NULL
                AND (expires_at IS NULL OR expires_at > NOW())) AS has_match_profile`,
    [userId]
  )
  return {
    subscription: Boolean(rows?.[0]?.has_subscription),
    resume: Boolean(rows?.[0]?.has_resume),
    matchProfile: Boolean(rows?.[0]?.has_match_profile)
  }
}

async function validateCareerWatchInput(input) {
  const normalized = normalizeCareerWatchInput(input)
  if (!normalized.roleFamilies.length) {
    throw Object.assign(new Error('请至少选择一个岗位方向'), { statusCode: 400, code: 'WATCH_ROLE_REQUIRED' })
  }
  const options = await getCareerWatchFilterOptions()
  const availableRoles = new Set(options.roles.map((item) => item.value))
  if (normalized.roleFamilies.some((role) => !availableRoles.has(role))) {
    throw Object.assign(new Error('岗位方向已更新，请重新选择'), { statusCode: 400, code: 'WATCH_OPTION_STALE' })
  }
  const preferenceValues = {
    teamSize: normalized.companyPreferences.teamSize,
    rating: normalized.companyPreferences.minRating,
    companyAge: normalized.companyPreferences.minFoundedYears,
    industry: normalized.companyPreferences.industries
  }
  const availableValues = {
    teamSize: new Set(options.teamSizes.map((item) => item.value)),
    rating: new Set(options.ratings.map((item) => item.value)),
    companyAge: new Set(options.companyAges.map((item) => item.value)),
    industry: new Set(options.industries.map((item) => item.value))
  }
  for (const key of normalized.activePreferenceKeys) {
    const value = preferenceValues[key]
    const valid = key === 'industry'
      ? Array.isArray(value) && value.length > 0 && value.every((item) => availableValues.industry.has(item))
      : availableValues[key].has(value)
    if (!valid) {
      throw Object.assign(new Error('企业条件已更新，请重新选择'), { statusCode: 400, code: 'WATCH_OPTION_STALE' })
    }
  }
  return normalized
}

export async function saveCareerWatchProfile({ userId, input, expectedVersion = null }) {
  const normalized = await validateCareerWatchInput(input)
  const current = await getCareerWatchProfile(userId)
  if (current && expectedVersion != null && Number(expectedVersion) !== current.version) {
    throw Object.assign(new Error('关注条件已在其他设备更新，请重新确认'), {
      statusCode: 409,
      code: 'WATCH_VERSION_CONFLICT',
      currentProfile: current
    })
  }
  const params = [
    userId, normalized.sourceMode, JSON.stringify(normalized.roleFamilies), JSON.stringify(normalized.customRoleTerms),
    JSON.stringify(normalized.companyPreferences), JSON.stringify(normalized.activePreferenceKeys),
    normalized.toleranceMode, normalized.status, normalized.resumeId, normalized.careerProfileId,
    normalized.sourcePlatform,
    Number(expectedVersion ?? current?.version ?? 0)
  ]
  const rows = await neonHelper.query(
    `INSERT INTO career_watch_profiles (
       user_id, source_mode, role_families, custom_role_terms, company_preferences,
       active_preference_keys, tolerance_mode, status, resume_id, career_profile_id,
       source_platform, created_at, updated_at
     ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       source_mode = EXCLUDED.source_mode,
       role_families = EXCLUDED.role_families,
       custom_role_terms = EXCLUDED.custom_role_terms,
       company_preferences = EXCLUDED.company_preferences,
       active_preference_keys = EXCLUDED.active_preference_keys,
       tolerance_mode = EXCLUDED.tolerance_mode,
       status = EXCLUDED.status,
       resume_id = COALESCE(EXCLUDED.resume_id, career_watch_profiles.resume_id),
       career_profile_id = COALESCE(EXCLUDED.career_profile_id, career_watch_profiles.career_profile_id),
       source_platform = EXCLUDED.source_platform,
       version = career_watch_profiles.version + 1,
       updated_at = NOW()
     WHERE career_watch_profiles.version = $12
     RETURNING *`,
    params
  )
  if (!rows?.[0]) {
    const latest = await getCareerWatchProfile(userId)
    throw Object.assign(new Error('关注条件已在其他设备更新，请重新确认'), {
      statusCode: 409,
      code: 'WATCH_VERSION_CONFLICT',
      currentProfile: latest
    })
  }
  const profile = mapProfile(rows?.[0])
  try {
    const subscriptions = await neonHelper.query(
      `SELECT subscription_id, to_jsonb(s) -> 'preferences' AS preferences,
              to_jsonb(s) ? 'preferences' AS has_preferences_column
         FROM subscriptions AS s
        WHERE user_id::text = $1::text AND channel = 'email'
        ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [userId]
    )
    const subscription = subscriptions?.[0]
    if (subscription) {
      const topics = profile.customRoleTerms.length
        ? profile.customRoleTerms
        : profile.roleFamilies.map((role) => CAREER_WATCH_ROLE_LABELS[role]).filter(Boolean)
      if (subscription.has_preferences_column) {
        const preferences = subscription.preferences && typeof subscription.preferences === 'object'
          ? subscription.preferences
          : {}
        await neonHelper.query(
          `UPDATE subscriptions
              SET topic = $1, preferences = $2::jsonb, updated_at = NOW()
            WHERE subscription_id = $3`,
          [
            topics.join(','),
            JSON.stringify({ ...preferences, topics, customTopic: topics[0] || null, customTopics: topics, source: 'career_watch' }),
            subscription.subscription_id
          ]
        )
      } else {
        await neonHelper.query(
          `UPDATE subscriptions
              SET topic = $1, updated_at = NOW()
            WHERE subscription_id = $2`,
          [topics.join(','), subscription.subscription_id]
        )
      }
    }
  } catch (error) {
    console.warn('[career-watch] email channel sync skipped', { code: error?.code || 'SUBSCRIPTION_SYNC_FAILED' })
  }
  return profile
}

function rolesFromSourceText(...values) {
  return uniqueStrings(values.flatMap((value) => roleFamiliesForText(String(value || ''))), 3, CAREER_WATCH_ROLE_FAMILIES)
}

export async function importCareerWatchDraft(userId, source) {
  if (source === 'subscription') {
    const rows = await neonHelper.query(
      `SELECT topic, updated_at, to_jsonb(s) -> 'preferences' AS preferences
         FROM subscriptions AS s
        WHERE user_id::text = $1::text AND status = 'active'
        ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [userId]
    )
    const item = rows?.[0]
    if (!item) throw Object.assign(new Error('没有找到可同步的订阅'), { statusCode: 404 })
    const topics = [item.topic, ...(item.preferences?.topics || []), ...(item.preferences?.customTopics || [])]
    return {
      source: 'subscription',
      sourceUpdatedAt: item.updated_at,
      draft: normalizeCareerWatchInput({ sourceMode: 'mixed', roleFamilies: rolesFromSourceText(...topics), sourcePlatform: 'legacy_subscription' })
    }
  }
  if (source === 'resume') {
    const rows = await neonHelper.query(
      `SELECT resume_id, content_text, parse_result, created_at FROM resumes
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    const item = rows?.[0]
    if (!item) throw Object.assign(new Error('没有找到可使用的简历'), { statusCode: 404 })
    return {
      source: 'resume',
      sourceUpdatedAt: item.created_at,
      draft: normalizeCareerWatchInput({
        sourceMode: 'resume',
        roleFamilies: rolesFromSourceText(item.content_text, JSON.stringify(item.parse_result || {})),
        resumeId: item.resume_id,
        sourcePlatform: 'web'
      })
    }
  }
  if (source === 'match_profile') {
    const rows = await neonHelper.query(
      `SELECT profile_id, career_text, structured_profile, updated_at FROM mini_career_profiles
        WHERE user_id = $1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    )
    const item = rows?.[0]
    if (!item) throw Object.assign(new Error('没有找到可同步的资料'), { statusCode: 404 })
    const structuredRoles = parseJsonArray(item.structured_profile?.roleFamilies)
    return {
      source: 'match_profile',
      sourceUpdatedAt: item.updated_at,
      draft: normalizeCareerWatchInput({
        sourceMode: 'mixed',
        roleFamilies: structuredRoles.length ? structuredRoles : rolesFromSourceText(item.career_text),
        careerProfileId: item.profile_id,
        sourcePlatform: 'mini'
      })
    }
  }
  throw Object.assign(new Error('不支持的同步来源'), { statusCode: 400 })
}

function employeeBand(value) {
  const text = String(value || '').replace(/,/g, '')
  const numbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0])).filter(Number.isFinite)
  const upper = numbers.length > 1 ? numbers[1] : numbers[0]
  if (!upper) return null
  if (upper <= 50) return 'small'
  if (upper <= 500) return 'growth'
  return 'large'
}

export async function getCareerWatchFilterOptions() {
  const [companyRows, roleRows] = await Promise.all([
    neonHelper.query(
      `SELECT industry, employee_count, founded_year, company_rating, rating_source
         FROM trusted_companies
        WHERE status = 'active'`
    ),
    neonHelper.query(
      `SELECT role AS value, COUNT(*)::int AS count
         FROM company_job_history history
         CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(history.role_families, '[]'::jsonb)) role
        WHERE history.closed_at IS NULL
        GROUP BY role`
    )
  ])
  const roleCounts = new Map((roleRows || []).map((row) => [String(row.value), Number(row.count || 0)]))
  const teamCounts = new Map(TEAM_SIZES.map((value) => [value, 0]))
  const industryCounts = new Map()
  const ratings = []
  const companyAges = []
  const currentYear = new Date().getFullYear()

  for (const row of companyRows || []) {
    const teamSize = employeeBand(row.employee_count)
    if (teamSize) teamCounts.set(teamSize, Number(teamCounts.get(teamSize) || 0) + 1)
    const industry = String(row.industry || '').trim()
    if (industry) industryCounts.set(industry, Number(industryCounts.get(industry) || 0) + 1)
    if (/glassdoor/i.test(String(row.rating_source || '')) && Number(row.company_rating) > 0) {
      ratings.push(Number(row.company_rating))
    }
    const foundedYear = Number(row.founded_year)
    if (foundedYear > 1800 && foundedYear <= currentYear) companyAges.push(currentYear - foundedYear)
  }

  const labels = { small: '50 人以内', growth: '51–500 人', large: '501 人以上' }
  const availableFamilies = new Set([...roleCounts.entries()].filter(([, count]) => count > 0).map(([value]) => value))
  const roleOptions = JOB_CATEGORY_OPTIONS
    .map((label) => ({ value: label, label, families: roleFamiliesForText(label).filter((family) => availableFamilies.has(family)) }))
    .filter((item) => item.families.length > 0)
  const assigned = new Set()
  const roleGroups = ROLE_OPTION_GROUPS.map((group) => {
    const options = roleOptions.filter((option) => {
      if (assigned.has(option.value)) return false
      if (!group.keywords.length) return true
      return group.keywords.some((keyword) => option.label.toLowerCase().includes(keyword.toLowerCase()))
    })
    options.forEach((option) => assigned.add(option.value))
    return { key: group.key, label: group.label, options }
  }).filter((group) => group.options.length > 0)
  return {
    roles: CAREER_WATCH_ROLE_FAMILIES
      .map((value) => ({ value, label: CAREER_WATCH_ROLE_LABELS[value], count: Number(roleCounts.get(value) || 0) }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count),
    roleGroups,
    teamSizes: TEAM_SIZES
      .map((value) => ({ value, label: labels[value], count: Number(teamCounts.get(value) || 0) }))
      .filter((item) => item.count > 0),
    ratings: [3.5, 4, 4.5]
      .map((value) => ({ value, label: `${value}+`, count: ratings.filter((rating) => rating >= value).length }))
      .filter((item) => item.count > 0),
    companyAges: [3, 5, 10]
      .map((value) => ({ value, label: `${value} 年以上`, count: companyAges.filter((age) => age >= value).length }))
      .filter((item) => item.count > 0),
    industries: [...industryCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
  }
}

function preferenceResult(key, preferences, company) {
  if (key === 'teamSize') {
    const actual = employeeBand(company.employee_count)
    return { key, status: actual ? (actual === preferences.teamSize ? 'matched' : 'not_matched') : 'missing', label: actual === preferences.teamSize ? '团队规模符合' : actual ? '团队规模接近' : '团队规模暂缺' }
  }
  if (key === 'rating') {
    const comparable = /glassdoor/i.test(String(company.rating_source || '')) && Number(company.company_rating) > 0
    const matched = comparable && Number(company.company_rating) >= Number(preferences.minRating)
    return { key, status: comparable ? (matched ? 'matched' : 'not_matched') : 'missing', label: comparable ? (matched ? `公开评分 ${Number(company.company_rating).toFixed(1)}` : '公开评分接近') : '公开评分暂缺' }
  }
  if (key === 'companyAge') {
    const founded = Number(company.founded_year)
    const years = founded > 1800 ? new Date().getFullYear() - founded : null
    const matched = years != null && years >= Number(preferences.minFoundedYears)
    return { key, status: years == null ? 'missing' : matched ? 'matched' : 'not_matched', label: years == null ? '成立时间暂缺' : matched ? `成立 ${years} 年` : '成立时间接近' }
  }
  const industries = uniqueStrings(preferences.industries, 3).map((item) => item.toLowerCase())
  const actual = String(company.industry || '').toLowerCase()
  const matched = Boolean(actual && industries.includes(actual))
  return { key, status: actual ? (matched ? 'matched' : 'not_matched') : 'missing', label: actual ? (matched ? `行业符合 · ${company.industry}` : `行业不符 · ${company.industry}`) : '行业暂缺' }
}

function mapFollowedUpdates(rows) {
  return (rows || []).map((row) => ({
    inboxId: row.inbox_id,
    companyId: String(row.company_id || ''),
    companyName: row.company_name || '',
    eventType: row.event_type,
    hasPublicOpportunity: Boolean(row.has_public_opportunity),
    occurredAt: row.occurred_at,
    status: row.status
  }))
}

function normalizedDirectionText(value) {
  return String(value || '').toLowerCase().replace(/[\s/\\|·,，、()（）_-]+/g, '')
}

function matchedCustomDirection(row, terms) {
  const title = normalizedDirectionText(row.title)
  const category = normalizedDirectionText(row.category)
  return terms.find((term) => {
    const normalized = normalizedDirectionText(term)
    return normalized && (title.includes(normalized) || category.includes(normalized) || Boolean(category && normalized.includes(category)))
  }) || ''
}

export async function getPublicCareerWatchFeed(limit = 6) {
  const rows = await neonHelper.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (tc.company_id)
         tc.company_id, tc.name AS company_name, tc.industry, tc.description,
         j.job_id, j.title, j.url, COALESCE(j.updated_at, j.published_at, j.created_at) AS updated_at
       FROM trusted_companies tc
       JOIN jobs j ON j.company_id = tc.company_id
         OR (j.company_id IS NULL AND LOWER(BTRIM(j.company)) = LOWER(BTRIM(tc.name)))
       WHERE tc.status = 'active' AND j.status = 'active' AND j.is_approved = TRUE
         AND NULLIF(BTRIM(j.url), '') IS NOT NULL
       ORDER BY tc.company_id, COALESCE(j.updated_at, j.published_at, j.created_at) DESC NULLS LAST
     ) latest
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $1`,
    [Math.max(1, Math.min(12, Number(limit) || 6))]
  )
  return (rows || []).map((row) => {
    const updatedAt = new Date(row.updated_at || 0).getTime()
    const hasUpdate = Number.isFinite(updatedAt) && Date.now() - updatedAt <= 7 * 86400000
    return {
      companyId: String(row.company_id),
      companyName: row.company_name,
      industry: row.industry || '',
      description: row.description || '',
      jobId: String(row.job_id || ''),
      jobTitle: row.title || '',
      applyUrl: row.url || '',
      reasons: [hasUpdate ? '公开岗位近期有更新' : '目前有公开岗位'],
      preferenceStatuses: [],
      isFollowed: false,
      hasUpdate,
      fitBand: 'public',
      score: 0,
      updatedAt: row.updated_at
    }
  })
}

async function applyLiveUserState(userId, recommendations, { preserveFixed = false } = {}) {
  const [follows, exposures] = await Promise.all([
    neonHelper.query(`SELECT company_id FROM mini_company_follows WHERE user_id = $1 AND status = 'active'`, [userId]),
    neonHelper.query(`SELECT company_id FROM mini_match_exposures WHERE user_id = $1 AND dismissed_at IS NOT NULL`, [userId])
  ])
  const followedIds = new Set((follows || []).map((row) => String(row.company_id)))
  const dismissedIds = new Set((exposures || []).map((row) => String(row.company_id)))
  return (recommendations || [])
    .filter((item) => preserveFixed || !dismissedIds.has(String(item.companyId)))
    .map((item) => ({ ...item, isFollowed: followedIds.has(String(item.companyId)) }))
}

export async function getCareerWatchAccessState(userId, isMember = false) {
  const recommendationCountSql = FIXED_MATCH_SNAPSHOT_ENABLED
    ? `CASE
         WHEN COALESCE(jsonb_array_length(snapshots.fixed_recommendations), 0) > 0
           THEN jsonb_array_length(snapshots.fixed_recommendations)
         ELSE LEAST(COALESCE(jsonb_array_length(snapshots.recommendations), 0), 5)
       END`
    : `LEAST(COALESCE(jsonb_array_length(snapshots.recommendations), 0), 5)`
  const rows = await neonHelper.query(
    `SELECT entitlements.free_assessment_used_at,
            (${recommendationCountSql})::int AS recommendation_count
       FROM (SELECT $1::varchar AS user_id) input
       LEFT JOIN ${CAREER_ENTITLEMENTS_TABLE} entitlements ON entitlements.user_id = input.user_id
       LEFT JOIN career_watch_feed_snapshots snapshots ON snapshots.user_id = input.user_id`,
    [userId]
  )
  const usedAt = rows?.[0]?.free_assessment_used_at || null
  const recommendationCount = Number(rows?.[0]?.recommendation_count || 0)
  return {
    matchState: isMember ? 'member_dynamic' : usedAt ? 'fixed_free' : 'unused',
    freeMatchAvailable: !usedAt,
    freeMatchUsedAt: usedAt,
    fixedCompanyCount: usedAt ? recommendationCount : 0
  }
}

async function getLiveFollowedUpdates(userId, limit = 50) {
  const rows = await neonHelper.query(
    `SELECT inbox.inbox_id, inbox.status, events.company_id, companies.name AS company_name,
            events.event_type, events.occurred_at, events.has_public_opportunity
       FROM mini_company_update_inbox inbox
       JOIN mini_company_update_events events ON events.event_id = inbox.event_id
       JOIN trusted_companies companies ON companies.company_id = events.company_id
      WHERE inbox.user_id = $1 AND inbox.status = 'unread'
      ORDER BY events.occurred_at DESC LIMIT $2`,
    [userId, Math.max(1, Math.min(50, Number(limit) || 50))]
  )
  return mapFollowedUpdates(rows)
}

export async function computeCareerWatchFeed({ userId, profile, isMember = false, limit = null, fixedFree = false }) {
  if (!profile || profile.status !== 'active') {
    return { recommendations: [], followedUpdates: [], generatedAt: new Date().toISOString(), emptyReason: 'watch_not_configured' }
  }
  const roleFamilies = uniqueStrings(profile.roleFamilies, 5, CAREER_WATCH_ROLE_FAMILIES)
  const customRoleTerms = uniqueStrings(profile.customRoleTerms, 5)
  const [rows, follows, updates, exposures] = await Promise.all([
    neonHelper.query(
      `SELECT tc.company_id, tc.name, tc.industry, tc.description, tc.employee_count,
              tc.founded_year, tc.company_rating, tc.rating_source,
              h.history_id, h.source_job_id, h.title, h.category, h.role_families, h.last_seen_at,
              h.source_published_at, h.is_public_opportunity, j.url
         FROM trusted_companies tc
         JOIN company_job_history h ON h.company_id = tc.company_id
         LEFT JOIN jobs j ON j.job_id = h.source_job_id
        WHERE tc.status = 'active'
          AND h.closed_at IS NULL
          AND h.is_public_opportunity IS TRUE
        ORDER BY COALESCE(h.source_published_at, h.last_seen_at) DESC NULLS LAST
        LIMIT 2500`
    ),
    neonHelper.query(`SELECT company_id FROM mini_company_follows WHERE user_id = $1 AND status = 'active'`, [userId]),
    neonHelper.query(
      `SELECT inbox.inbox_id, inbox.status, events.company_id, companies.name AS company_name,
              events.event_type, events.occurred_at, events.has_public_opportunity
         FROM mini_company_update_inbox inbox
         JOIN mini_company_update_events events ON events.event_id = inbox.event_id
         JOIN trusted_companies companies ON companies.company_id = events.company_id
        WHERE inbox.user_id = $1 AND inbox.status = 'unread'
        ORDER BY events.occurred_at DESC LIMIT 20`,
      [userId]
    ),
    neonHelper.query(`SELECT company_id FROM mini_match_exposures WHERE user_id = $1 AND dismissed_at IS NOT NULL`, [userId])
  ])
  const dismissedIds = new Set((exposures || []).map((row) => String(row.company_id)))
  const grouped = new Map()
  for (const row of rows || []) {
    const jobRoles = uniqueStrings(parseJsonArray(row.role_families), 12, CAREER_WATCH_ROLE_FAMILIES)
    if (!jobRoles.some((role) => roleFamilies.includes(role))) continue
    const id = String(row.company_id)
    if (dismissedIds.has(id)) continue
    if (!grouped.has(id)) grouped.set(id, { company: row, jobs: [] })
    grouped.get(id).jobs.push(row)
  }
  const followedIds = new Set((follows || []).map((row) => String(row.company_id)))
  const activeKeys = uniqueStrings(profile.activePreferenceKeys, 4, PREFERENCE_KEYS)
  const recommendations = []
  for (const { company, jobs } of grouped.values()) {
    const statuses = activeKeys.map((key) => preferenceResult(key, profile.companyPreferences || {}, company))
    if (!fixedFree && profile.toleranceMode === 'strict' && statuses.some((item) => item.status !== 'matched')) continue
    const matched = statuses.filter((item) => item.status === 'matched').length
    const preferenceScore = activeKeys.length ? matched / activeKeys.length * 25 : 25
    const exactJobs = customRoleTerms.length ? jobs.filter((job) => matchedCustomDirection(job, customRoleTerms)) : []
    const latest = exactJobs[0] || jobs[0]
    const matchedDirection = matchedCustomDirection(latest, customRoleTerms)
    const latestTime = new Date(latest.source_published_at || latest.last_seen_at || 0).getTime()
    const days = Number.isFinite(latestTime) ? Math.max(0, (Date.now() - latestTime) / 86400000) : 999
    const freshnessScore = days <= 7 ? 15 : days <= 30 ? 10 : 5
    const score = Math.min(100, Math.round(55 + preferenceScore + freshnessScore + (matchedDirection ? 5 : 0)))
    const roleLabel = roleFamilies.map((role) => CAREER_WATCH_ROLE_LABELS[role]).filter(Boolean).slice(0, 2).join('、')
    const directionLabel = matchedDirection || roleLabel
    const reasons = [
      days <= 7 ? `${directionLabel}岗位近期有更新` : `${directionLabel}有相关岗位`,
      ...statuses.map((item) => item.label)
    ].slice(0, 3)
    recommendations.push({
      companyId: String(company.company_id),
      companyName: company.name,
      industry: company.industry || '',
      description: company.description || '',
      jobId: String(latest.source_job_id || ''),
      jobTitle: latest.title || '',
      applyUrl: latest.url || '',
      reasons,
      preferenceStatuses: statuses,
      isFollowed: followedIds.has(String(company.company_id)),
      hasUpdate: days <= 7,
      fitBand: score >= 90 ? 'high' : score >= 78 ? 'notable' : 'explore',
      score,
      directionSpecificity: matchedDirection ? 1 : 0,
      updatedAt: latest.source_published_at || latest.last_seen_at
    })
  }
  recommendations.sort((left, right) => Number(right.isFollowed) - Number(left.isFollowed) || right.directionSpecificity - left.directionSpecificity || right.score - left.score || new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
  const resultLimit = Math.max(1, Math.min(50, Number(limit) || (isMember ? 20 : 5)))
  return {
    recommendations: recommendations.slice(0, resultLimit).map((item) => {
      const publicItem = { ...item }
      delete publicItem.directionSpecificity
      return publicItem
    }),
    followedUpdates: mapFollowedUpdates(updates),
    generatedAt: new Date().toISOString(),
    emptyReason: recommendations.length ? null : profile.toleranceMode === 'strict' ? 'strict_filters' : 'no_role_update'
  }
}

export async function getCareerWatchFeed({ userId, profile, isMember = false, fixedFree = false }) {
  if ((!profile || profile.status !== 'active') && !fixedFree) {
    return { recommendations: [], followedUpdates: [], generatedAt: new Date().toISOString(), emptyReason: 'watch_not_configured', source: 'empty' }
  }
  let snapshot = null
  try {
    const rows = await neonHelper.query('SELECT * FROM career_watch_feed_snapshots WHERE user_id = $1 LIMIT 1', [userId])
    snapshot = rows?.[0] || null
    const maxAge = (isMember ? 6 : 24) * 60 * 60 * 1000
    if (snapshot && (fixedFree || (Number(snapshot.profile_version) === Number(profile.version) && Date.now() - new Date(snapshot.generated_at).getTime() < maxAge))) {
      const cachedRecommendations = fixedFree
        ? (FIXED_MATCH_SNAPSHOT_ENABLED && parseJsonArray(snapshot.fixed_recommendations).length
            ? parseJsonArray(snapshot.fixed_recommendations)
            : parseJsonArray(snapshot.recommendations).slice(0, 5))
        : parseJsonArray(snapshot.recommendations)
      return {
        recommendations: await applyLiveUserState(userId, cachedRecommendations, { preserveFixed: fixedFree }),
        followedUpdates: await getLiveFollowedUpdates(userId),
        generatedAt: snapshot.generated_at,
        emptyReason: snapshot.empty_reason || null,
        source: 'cached'
      }
    }
    if (!profile || profile.status !== 'active') {
      return { recommendations: [], followedUpdates: [], generatedAt: new Date().toISOString(), emptyReason: 'watch_not_configured', source: 'empty' }
    }
    const result = await computeCareerWatchFeed({ userId, profile, isMember, limit: isMember ? 20 : 5, fixedFree })
    await neonHelper.query(
      `INSERT INTO career_watch_feed_snapshots (
         user_id, profile_version, recommendations, followed_updates, empty_reason, generated_at
       ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         profile_version = EXCLUDED.profile_version,
         recommendations = EXCLUDED.recommendations,
         followed_updates = EXCLUDED.followed_updates,
         empty_reason = EXCLUDED.empty_reason,
         generated_at = NOW()`,
      [userId, profile.version, JSON.stringify(result.recommendations), JSON.stringify(result.followedUpdates), result.emptyReason]
    )
    return { ...result, source: 'recomputed' }
  } catch (error) {
    if (snapshot) {
      const staleRecommendations = fixedFree
        ? (FIXED_MATCH_SNAPSHOT_ENABLED && parseJsonArray(snapshot.fixed_recommendations).length
            ? parseJsonArray(snapshot.fixed_recommendations)
            : parseJsonArray(snapshot.recommendations).slice(0, 5))
        : parseJsonArray(snapshot.recommendations)
      return {
        recommendations: await applyLiveUserState(userId, staleRecommendations, { preserveFixed: fixedFree }),
        followedUpdates: await getLiveFollowedUpdates(userId),
        generatedAt: snapshot.generated_at,
        emptyReason: snapshot.empty_reason || null,
        source: 'stale',
        stale: true
      }
    }
    throw error
  }
}

export async function createFixedCareerWatchMatch({ userId, input, expectedVersion = null }) {
  const currentAccess = await getCareerWatchAccessState(userId, false)
  if (!currentAccess.freeMatchAvailable) {
    throw Object.assign(new Error('当前匹配结果已生成'), {
      statusCode: 409,
      code: 'FREE_MATCH_USED'
    })
  }
  const normalized = await validateCareerWatchInput(input)
  const current = await getCareerWatchProfile(userId)
  const versionToMatch = Number(expectedVersion ?? current?.version ?? 0)
  if (current && versionToMatch !== current.version) {
    throw Object.assign(new Error('关注条件已在其他设备更新，请重新确认'), {
      statusCode: 409,
      code: 'WATCH_VERSION_CONFLICT',
      currentProfile: current
    })
  }
  const previewProfile = { ...normalized, version: current ? current.version + 1 : 1 }
  const computed = await computeCareerWatchFeed({
    userId,
    profile: previewProfile,
    isMember: false,
    limit: 5,
    fixedFree: true
  })
  if (computed.recommendations.length !== 5) {
    throw Object.assign(new Error('暂时无法生成匹配结果，请稍后重试'), {
      statusCode: 503,
      code: 'MATCH_DATA_NOT_READY'
    })
  }
  const fixedColumn = FIXED_MATCH_SNAPSHOT_ENABLED ? ', fixed_recommendations' : ''
  const fixedValue = FIXED_MATCH_SNAPSHOT_ENABLED ? ', $13::jsonb' : ''
  const fixedUpdate = FIXED_MATCH_SNAPSHOT_ENABLED ? ', fixed_recommendations = EXCLUDED.fixed_recommendations' : ''
  const rows = await neonHelper.query(
    `WITH input_gate AS (
       SELECT $1::varchar AS user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM ${CAREER_ENTITLEMENTS_TABLE}
           WHERE user_id = $1 AND free_assessment_used_at IS NOT NULL
        )
          AND (
            (NOT EXISTS (SELECT 1 FROM career_watch_profiles WHERE user_id = $1) AND $12::int = 0)
            OR EXISTS (SELECT 1 FROM career_watch_profiles WHERE user_id = $1 AND version = $12::int)
          )
     ), reserved AS (
       INSERT INTO ${CAREER_ENTITLEMENTS_TABLE} (user_id, free_assessment_used_at, created_at, updated_at)
       SELECT user_id, NOW(), NOW(), NOW() FROM input_gate
       ON CONFLICT (user_id) DO UPDATE SET
         free_assessment_used_at = NOW(), updated_at = NOW()
       WHERE ${CAREER_ENTITLEMENTS_TABLE}.free_assessment_used_at IS NULL
       RETURNING user_id
     ), saved_profile AS (
       INSERT INTO career_watch_profiles (
         user_id, source_mode, role_families, custom_role_terms, company_preferences,
         active_preference_keys, tolerance_mode, status, resume_id, career_profile_id,
         source_platform, created_at, updated_at
       )
       SELECT $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
              $7, $8, $9, $10, $11, NOW(), NOW()
         FROM reserved
       ON CONFLICT (user_id) DO UPDATE SET
         source_mode = EXCLUDED.source_mode,
         role_families = EXCLUDED.role_families,
         custom_role_terms = EXCLUDED.custom_role_terms,
         company_preferences = EXCLUDED.company_preferences,
         active_preference_keys = EXCLUDED.active_preference_keys,
         tolerance_mode = EXCLUDED.tolerance_mode,
         status = EXCLUDED.status,
         resume_id = COALESCE(EXCLUDED.resume_id, career_watch_profiles.resume_id),
         career_profile_id = COALESCE(EXCLUDED.career_profile_id, career_watch_profiles.career_profile_id),
         source_platform = EXCLUDED.source_platform,
         version = career_watch_profiles.version + 1,
         updated_at = NOW()
       WHERE career_watch_profiles.version = $12::int
       RETURNING *
     ), saved_snapshot AS (
       INSERT INTO career_watch_feed_snapshots (
         user_id, profile_version, recommendations${fixedColumn}, followed_updates, empty_reason, generated_at
       )
       SELECT $1, saved_profile.version, $13::jsonb${fixedValue}, $14::jsonb, NULL, NOW()
         FROM saved_profile
       ON CONFLICT (user_id) DO UPDATE SET
         profile_version = EXCLUDED.profile_version,
         recommendations = EXCLUDED.recommendations${fixedUpdate},
         followed_updates = EXCLUDED.followed_updates,
         empty_reason = NULL,
         generated_at = NOW()
       RETURNING user_id
     )
     SELECT saved_profile.* FROM saved_profile JOIN saved_snapshot USING (user_id)`,
    [
      userId,
      normalized.sourceMode,
      JSON.stringify(normalized.roleFamilies),
      JSON.stringify(normalized.customRoleTerms),
      JSON.stringify(normalized.companyPreferences),
      JSON.stringify(normalized.activePreferenceKeys),
      normalized.toleranceMode,
      normalized.status,
      normalized.resumeId,
      normalized.careerProfileId,
      normalized.sourcePlatform,
      versionToMatch,
      JSON.stringify(computed.recommendations),
      JSON.stringify(computed.followedUpdates)
    ]
  )
  if (!rows?.[0]) {
    const access = await getCareerWatchAccessState(userId, false)
    if (!access.freeMatchAvailable) {
      throw Object.assign(new Error('当前匹配结果已生成'), {
        statusCode: 409,
        code: 'FREE_MATCH_USED'
      })
    }
    throw Object.assign(new Error('关注条件已在其他设备更新，请重新确认'), {
      statusCode: 409,
      code: 'WATCH_VERSION_CONFLICT',
      currentProfile: await getCareerWatchProfile(userId)
    })
  }
  return mapProfile(rows[0])
}

export async function setCareerWatchNotifications(userId, { enabled, templateStatus = 'not_requested' } = {}) {
  const safeStatus = ['not_requested', 'accepted', 'rejected', 'unavailable'].includes(templateStatus)
    ? templateStatus
    : 'not_requested'
  if (enabled && safeStatus !== 'accepted') {
    throw Object.assign(new Error('请先完成微信订阅消息授权'), {
      statusCode: 403,
      code: 'SUBSCRIBE_AUTH_REQUIRED'
    })
  }
  const rows = await neonHelper.query(
    `UPDATE career_watch_profiles
        SET in_app_enabled = TRUE,
            wechat_enabled = $1,
            wechat_template_status = $2,
            updated_at = NOW()
      WHERE user_id = $3
      RETURNING *`,
    [Boolean(enabled), safeStatus, userId]
  )
  if (!rows?.[0]) throw Object.assign(new Error('请先设置求职方向'), { statusCode: 409, code: 'WATCH_NOT_CONFIGURED' })
  return mapProfile(rows[0])
}
