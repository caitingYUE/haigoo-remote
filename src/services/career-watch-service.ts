export type WatchRoleFamily = 'product' | 'project' | 'engineering' | 'design' | 'data' | 'marketing' | 'sales' | 'operations' | 'research' | 'finance' | 'hr'
export type WatchPreferenceKey = 'teamSize' | 'rating' | 'companyAge' | 'industry'

export interface CareerWatchFilterOptions {
  roles: Array<{ value: WatchRoleFamily; label: string; count: number }>
  teamSizes: Array<{ value: 'small' | 'growth' | 'large'; label: string; count: number }>
  ratings: Array<{ value: 3.5 | 4 | 4.5; label: string; count: number }>
  companyAges: Array<{ value: 3 | 5 | 10; label: string; count: number }>
  industries: Array<{ value: string; label: string; count: number }>
}

export interface CareerWatchProfile {
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
  version: number
  updatedAt: string
}

export interface CareerWatchFeedItem {
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
  fitBand: 'high' | 'notable' | 'explore' | 'public'
  score: number
  publishedAt: string
  updatedAt: string
}

export interface CareerWatchResponse {
  success: true
  authenticated: boolean
  profile: CareerWatchProfile | null
  filterOptions: CareerWatchFilterOptions
  importSources?: { subscription: boolean; resume: boolean; matchProfile: boolean }
  entitlements?: { isMember: boolean; maxRoleFamilies: number; maxPreferenceTypes: number | null; maxFollows: number | null; refreshHours: number | null; proactiveDigest: boolean }
  recommendations: CareerWatchFeedItem[]
  followedUpdates: Array<{ inboxId: string; companyId: string; companyName: string; eventType: string; hasPublicOpportunity: boolean; occurredAt: string; status: string }>
  generatedAt: string
  source?: 'empty' | 'cached' | 'recomputed' | 'stale'
  stale?: boolean
  emptyReason?: 'watch_not_configured' | 'strict_filters' | 'no_role_update' | null
}

function headers(token?: string | null, json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({ success: false, error: '请求失败，请稍后重试' }))
  if (!response.ok || !data.success) {
    const error = Object.assign(new Error(data.error || '请求失败，请稍后重试'), { code: data.code, currentProfile: data.currentProfile })
    throw error
  }
  return data
}

export async function getCareerWatch(token?: string | null): Promise<CareerWatchResponse> {
  return readResponse(await fetch('/api/career-watch', { headers: headers(token) }))
}

export async function saveCareerWatch(token: string, input: Omit<CareerWatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform'>): Promise<CareerWatchResponse> {
  return readResponse(await fetch('/api/career-watch', { method: 'PUT', headers: headers(token, true), body: JSON.stringify(input) }))
}

export async function importCareerWatch(token: string, source: 'subscription' | 'resume' | 'match_profile') {
  return readResponse(await fetch('/api/career-watch?action=import', { method: 'POST', headers: headers(token, true), body: JSON.stringify({ source }) })) as Promise<{ success: true; source: string; sourceUpdatedAt: string; draft: Omit<CareerWatchProfile, 'profileId' | 'updatedAt' | 'version'> }>
}

export async function setCareerWatchFollow(token: string, companyId: string, followed: boolean) {
  return readResponse(await fetch('/api/career-watch?action=follow', { method: 'POST', headers: headers(token, true), body: JSON.stringify({ companyId, followed }) }))
}

export async function sendCareerWatchFeedback(token: string, companyId: string, action: 'opened' | 'dismissed' | 'seen') {
  return readResponse(await fetch('/api/career-watch?action=feedback', { method: 'POST', headers: headers(token, true), body: JSON.stringify({ companyId, action }) }))
}

export async function markCareerWatchUpdatesRead(token: string, inboxIds: string[]) {
  return readResponse(await fetch('/api/career-watch?action=updates-read', { method: 'POST', headers: headers(token, true), body: JSON.stringify({ inboxIds }) }))
}
