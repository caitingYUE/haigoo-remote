import type {
  CareerCompleteness,
  CareerIntake,
  CareerMatchResult,
  CareerMatchState,
  CareerRetentionPolicy
} from '../types'
import Taro from '@tarojs/taro'
import { createRequestKey, requestJson } from './api-client'
import { resolveCloudFileUrls } from './cloud-asset-service'
import { getMiniUser } from './session'

export const CAREER_PRIVACY_VERSION = '2026-08-14-match-v1'

export function fetchCareerMatchState() {
  return requestJson<CareerMatchState>('/mini/match', { authenticated: true })
}

export async function fetchMatchFeed() {
  const response = await requestJson<MatchFeedResponse>('/mini/match/feed', { authenticated: true })
  const urls = await resolveCloudFileUrls(response.recommendations.map((company) => company.logoFileId))
  return {
    ...response,
    recommendations: response.recommendations.map((company) => ({
      ...company,
      logoUrl: urls.get(company.logoFileId || '') || company.logoUrl || company.logoFileId || ''
    }))
  }
}

export function followCompany(companyId: string) {
  return requestJson<{ success: true; companyId: string; followed: boolean }>('/mini/match/follows', {
    method: 'POST', authenticated: true, data: { companyId, followed: true }
  })
}

export function unfollowCompany(companyId: string) {
  return requestJson<{ success: true; companyId: string; followed: boolean }>(`/mini/match/follows/${encodeURIComponent(companyId)}`, {
    method: 'DELETE', authenticated: true
  })
}

export function sendMatchFeedback(companyId: string, action: 'opened' | 'dismissed' | 'seen') {
  return requestJson<{ success: true }>('/mini/match/feedback', {
    method: 'POST', authenticated: true, data: { companyId, action }
  })
}

export function setMatchNotifications(companyId: string, enabled: boolean, templateStatus: string) {
  return requestJson<{ success: true; enabled: boolean; templateStatus: string }>(`/mini/match/follows/${encodeURIComponent(companyId)}/notifications`, {
    method: 'POST', authenticated: true, data: { enabled, templateStatus }
  })
}

export function parseCareerResume(filename: string, fileBase64: string) {
  return requestJson<{
    success: true
    sourceType: 'resume'
    structured: Record<string, unknown>
    completeness: CareerCompleteness
    rawFileStored: false
    message: string
  }>('/mini/match/resume/parse', {
    method: 'POST',
    authenticated: true,
    data: { filename, fileBase64 }
  })
}

export async function parseCareerResumeFile(filename: string, filePath: string) {
  const ownerId = String(getMiniUser()?.userId || 'bound').replace(/[^A-Za-z0-9_-]/g, '_')
  const safeName = String(filename || 'resume.pdf').replace(/[^A-Za-z0-9._-]/g, '_')
  const cloudPath = `mini-career-resumes/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
  let fileID = ''
  try {
    const uploaded = await Taro.cloud.uploadFile({ cloudPath, filePath })
    fileID = String(uploaded.fileID || '')
    if (!fileID) throw new Error('简历上传没有完成，请重试')
    return await requestJson<{
      success: true
      sourceType: 'resume'
      structured: Record<string, unknown>
      completeness: CareerCompleteness
      rawFileStored: false
      message: string
    }>('/mini/match/resume/parse', {
      method: 'POST',
      authenticated: true,
      timeout: 90000,
      data: { filename: safeName, fileId: fileID }
    })
  } finally {
    if (fileID) await Taro.cloud.deleteFile({ fileList: [fileID] }).catch(() => undefined)
  }
}

export async function syncCareerResumeFile(filename: string, filePath: string) {
  const ownerId = String(getMiniUser()?.userId || 'bound').replace(/[^A-Za-z0-9_-]/g, '_')
  const safeName = String(filename || 'resume.pdf').replace(/[^A-Za-z0-9._-]/g, '_')
  const cloudPath = `mini-career-resumes/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
  let fileID = ''
  try {
    const uploaded = await Taro.cloud.uploadFile({ cloudPath, filePath })
    fileID = String(uploaded.fileID || '')
    if (!fileID) throw new Error('简历保存没有完成，请重试')
    return await requestJson<{ success: true; saved: true; duplicate: boolean; resumeId: string }>('/mini/match/resume/sync', {
      method: 'POST', authenticated: true, timeout: 90000, data: { filename: safeName, fileId: fileID }
    })
  } finally {
    if (fileID) await Taro.cloud.deleteFile({ fileList: [fileID] }).catch(() => undefined)
  }
}

export type WatchRoleFamily = 'product' | 'project' | 'engineering' | 'design' | 'data' | 'marketing' | 'sales' | 'operations' | 'research' | 'finance' | 'hr'
export type WatchPreferenceKey = 'teamSize' | 'rating' | 'companyAge' | 'industry'

export interface WatchFilterOptions {
  roles: Array<{ value: WatchRoleFamily; label: string; count: number }>
  roleGroups?: Array<{
    key: string
    label: string
    options: Array<{ value: string; label: string; families: WatchRoleFamily[] }>
  }>
  teamSizes: Array<{ value: 'small' | 'growth' | 'large'; label: string; count: number }>
  ratings: Array<{ value: 3.5 | 4 | 4.5; label: string; count: number }>
  companyAges: Array<{ value: 3 | 5 | 10; label: string; count: number }>
  industries: Array<{ value: string; label: string; count: number }>
}

const RESUME_DIRECTION_ALIASES: Array<[string, string[]]> = [
  ['产品经理', ['product manager', 'product owner', '产品经理', '产品负责人']],
  ['运营', ['product operations', 'product ops', 'operations manager', 'operation manager', '运营经理', '产品运营']],
  ['前端开发', ['frontend engineer', 'front-end engineer', 'frontend developer', '前端工程师', '前端开发']],
  ['后端开发', ['backend engineer', 'back-end engineer', 'backend developer', '后端工程师', '后端开发']],
  ['全栈开发', ['full stack engineer', 'full-stack engineer', 'fullstack developer', '全栈工程师', '全栈开发']],
  ['移动开发', ['mobile engineer', 'ios engineer', 'android engineer', '移动端开发', '移动开发']],
  ['软件开发', ['software engineer', 'software developer', '软件工程师', '软件开发']],
  ['数据分析', ['data analyst', 'business intelligence analyst', 'bi analyst', '数据分析师']],
  ['商业分析', ['business analyst', '商业分析师']],
  ['数据科学', ['data scientist', '数据科学家']],
  ['数据开发', ['data engineer', '数据工程师']],
  ['算法工程师', ['machine learning engineer', 'ml engineer', '算法工程师', '机器学习工程师']],
  ['产品设计', ['product designer', '产品设计师']],
  ['UI/UX设计', ['ux designer', 'ui/ux designer', '交互设计师', '用户体验设计']],
  ['视觉设计', ['visual designer', '视觉设计师']],
  ['平面设计', ['graphic designer', '平面设计师']],
  ['测试/QA', ['qa engineer', 'test engineer', 'quality assurance engineer', '测试工程师']],
  ['运维/SRE', ['devops engineer', 'site reliability engineer', 'sre', '运维工程师']],
  ['市场营销', ['marketing manager', 'growth marketer', '市场经理', '增长营销']],
  ['销售', ['sales manager', 'account executive', '销售经理']],
  ['商务拓展', ['business development manager', 'business development', '商务拓展']],
  ['客户服务', ['customer success manager', 'customer support', 'customer service', '客户成功经理', '客户支持', '客服']],
  ['招聘', ['technical recruiter', 'recruiter', 'talent acquisition', '招聘专员', '招聘经理']],
  ['财务', ['financial analyst', 'finance analyst', '财务分析师']],
  ['内容创作', ['content manager', 'content strategist', 'copywriter', '内容运营', '内容策略', '文案']]
]

function resumeDirectionSignals(structured: Record<string, unknown>) {
  return ['roles', 'roleTerms']
    .flatMap((key) => Array.isArray(structured[key]) ? structured[key] as unknown[] : [])
    .map((value) => String(value || '').normalize('NFKC').toLowerCase().trim())
    .filter(Boolean)
}

export function mapResumeCareerDirections(structured: Record<string, unknown>, filterOptions: WatchFilterOptions) {
  const options = (filterOptions.roleGroups || []).flatMap((group) => group.options)
  const byValue = new Map(options.map((option) => [option.value, option]))
  const signals = resumeDirectionSignals(structured)
  const matchedValues: string[] = []

  for (const [value, aliases] of RESUME_DIRECTION_ALIASES) {
    if (!byValue.has(value)) continue
    const matched = signals.some((signal) => aliases.some((alias) => signal.includes(alias.toLowerCase())))
    if (matched && !matchedValues.includes(value)) matchedValues.push(value)
    if (matchedValues.length >= 5) break
  }

  for (const option of options) {
    if (matchedValues.length >= 5 || matchedValues.includes(option.value)) continue
    const normalized = option.label.normalize('NFKC').toLowerCase().trim()
    if (normalized && signals.some((signal) => signal === normalized)) matchedValues.push(option.value)
  }

  return {
    customRoleTerms: matchedValues,
    roleFamilies: [...new Set(matchedValues.flatMap((value) => byValue.get(value)?.families || []))].slice(0, 5)
  }
}

export interface WatchProfile {
  profileId: string
  sourceMode: 'resume' | 'manual' | 'mixed'
  roleFamilies: WatchRoleFamily[]
  customRoleTerms: string[]
  companyPreferences: {
    teamSize?: 'small' | 'growth' | 'large'
    minRating?: 3.5 | 4 | 4.5
    minFoundedYears?: 3 | 5 | 10
    industries?: string[]
  }
  activePreferenceKeys: WatchPreferenceKey[]
  toleranceMode: 'balanced' | 'strict'
  status: 'active' | 'paused'
  resumeId?: string | null
  careerProfileId?: string | null
  sourcePlatform: 'mini' | 'web' | 'legacy_subscription'
  inAppEnabled: boolean
  wechatEnabled: boolean
  wechatTemplateStatus: 'not_requested' | 'accepted' | 'rejected' | 'unavailable'
  version: number
  updatedAt: string
}

export interface WatchFeedItem {
  companyId: string
  companyName: string
  industry: string
  description: string
  jobId: string
  jobTitle: string
  applyUrl: string
  reasons: string[]
  preferenceStatuses: Array<{ key: WatchPreferenceKey; status: 'matched' | 'missing' | 'not_matched'; label: string }>
  isFollowed: boolean
  hasUpdate: boolean
  fitBand: 'high' | 'notable' | 'explore'
  score: number
  updatedAt: string
}

export interface CareerWatchResponse {
  success: true
  matchState: 'unused' | 'fixed_free' | 'member_dynamic'
  freeMatchAvailable: boolean
  freeMatchUsedAt: string | null
  fixedCompanyCount: number
  profile: WatchProfile | null
  filterOptions: WatchFilterOptions
  importSources?: { subscription: boolean; resume: boolean; matchProfile: boolean }
  entitlements: {
    isMember: boolean
    maxRoleFamilies: number
    maxPreferenceTypes: number | null
    maxFollows: number | null
    refreshHours: number | null
    proactiveDigest: boolean
    wechatTemplateId: string
    wechatSubscriptionAvailable: boolean
  }
  recommendations: WatchFeedItem[]
  followedUpdates: Array<{ inboxId: string; companyId: string; companyName: string; eventType: string; hasPublicOpportunity: boolean; occurredAt: string; status: string }>
  generatedAt: string
  source?: 'empty' | 'cached' | 'recomputed' | 'stale'
  stale?: boolean
  emptyReason: 'watch_not_configured' | 'strict_filters' | 'no_role_update' | null
}

export function fetchCareerWatch() {
  return requestJson<CareerWatchResponse>('/mini/career-watch', { authenticated: true })
}

export function fetchCareerWatchOptions() {
  return requestJson<{ success: true; filterOptions: WatchFilterOptions; capabilities: { wechatSubscriptionAvailable: boolean } }>('/mini/career-watch/options')
}

export function saveCareerWatch(data: Omit<WatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform' | 'version' | 'inAppEnabled' | 'wechatEnabled' | 'wechatTemplateStatus'> & { version?: number }) {
  return requestJson<CareerWatchResponse>('/mini/career-watch', {
    method: 'PUT', authenticated: true, data
  })
}

export function importCareerWatch(source: 'subscription' | 'resume' | 'match_profile') {
  return requestJson<{ success: true; source: string; sourceUpdatedAt: string; draft: Omit<WatchProfile, 'profileId' | 'updatedAt' | 'version'> }>('/mini/career-watch/import', {
    method: 'POST', authenticated: true, data: { source }
  })
}

export function setCareerWatchNotifications(enabled: boolean, templateStatus: WatchProfile['wechatTemplateStatus']) {
  return requestJson<{ success: true; enabled: boolean; templateStatus: WatchProfile['wechatTemplateStatus'] }>('/mini/career-watch/notifications', {
    method: 'POST', authenticated: true, data: { enabled, templateStatus }
  })
}

export function fetchCompanyFollows() {
  return requestJson<{ success: true; follows: Array<{ company_id: string; name: string; industry: string }> }>('/mini/match/follows', {
    authenticated: true
  })
}

export function markCareerWatchUpdatesRead(inboxIds: string[]) {
  return requestJson<{ success: true; updated: number }>('/mini/match/updates/read', {
    method: 'POST', authenticated: true, data: { inboxIds }
  })
}

export function saveCareerProfile(data: {
  sourceType: 'manual' | 'resume'
  careerText: string
  intake: CareerIntake
  retentionPolicy: CareerRetentionPolicy
  consentedAt: string
}) {
  return requestJson<{
    success: true
    stored: boolean
    profile: Record<string, unknown>
    completeness: CareerCompleteness
  }>('/mini/match/profile', {
    method: 'PUT',
    authenticated: true,
    data: { ...data, privacyVersion: CAREER_PRIVACY_VERSION }
  })
}

export function analyzeCareerProfile(data: {
  retentionPolicy: CareerRetentionPolicy
  careerText?: string
  intake?: CareerIntake
  answers?: Array<{ question: string; answer: string }>
}) {
  return requestJson<{
    success: true
    status: 'needs_clarification' | 'ready'
    result: CareerMatchResult
    rawFileStored: false
    stored: boolean
  }>('/mini/match/analyze', {
    method: 'POST',
    authenticated: true,
    timeout: 120000,
    data: { ...data, idempotencyKey: createRequestKey('career-match') }
  })
}

export function deleteCareerData(scope: 'profile' | 'resume' = 'profile', resumeId = '') {
  return requestJson<{ success: true; deleted: boolean; message: string }>('/mini/match/data', {
    method: 'DELETE',
    authenticated: true,
    data: { scope, resumeId }
  })
}

export interface MatchRecommendation {
  companyId: string
  name: string
  industry: string
  description: string
  logoFileId?: string
  logoUrl?: string
  fitBand: 'high' | 'notable' | 'explore'
  reasons: string[]
  evidenceSummary: string
  hasPublicOpportunity: boolean
  opportunity?: { jobId: string; title: string } | null
  isFollowed: boolean
  hasUpdate: boolean
}

export interface MatchFeedResponse {
  success: true
  profile: {
    exists: boolean
    completeness: number
    retentionPolicy?: CareerRetentionPolicy
    expiresAt?: string | null
    updatedAt?: string | null
  }
  recommendations: MatchRecommendation[]
  followedUpdates: Array<Record<string, unknown>>
  meta: {
    source: 'cached' | 'recomputed'
    hasNewData: boolean
    poolExhausted: boolean
    generatedAt: string
    algorithmVersion: string
    fallbackUsed?: boolean
    historyWindowDays?: number
    dailyLimit?: number
    emptyReason?: 'profile_incomplete' | 'no_supported_match' | null
  }
  capabilities: {
    isMember: boolean
    maxRecommendations: number
    maxFollows: number | null
    wechatTemplateId: string
    wechatSubscriptionAvailable: boolean
  }
}
