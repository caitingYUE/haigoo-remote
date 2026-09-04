import type { ConsultationRequest, GrowthNote, MemberServiceEntitlement, MiniCompany, MiniCompanyJobDetail, MiniMembershipPlan } from '../types'
import { createRequestKey, requestJson } from './api-client'
import { isRenderableImageSource, resolveCloudFileUrls } from './cloud-asset-service'

const MINI_PLAN_CONTRACTS = {
  club_starter_monthly: { memberType: 'starter', price: 99, durationMonths: 1 },
  mini_club_quarter_2026: { memberType: 'quarter', price: 199, durationMonths: 3 },
  mini_club_half_year_2026: { memberType: 'half_year', price: 699, durationMonths: 6 }
} as const

const MINI_PLAN_FALLBACKS: MiniMembershipPlan[] = [
  {
    id: 'club_starter_monthly', memberType: 'starter', name: '月度会员', shortLabel: '月度会员',
    price: 99, currency: 'CNY', durationDays: 0, durationMonths: 1, featured: false,
    description: '适合按月体验完整企业与岗位数据。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    features: ['浏览在招远程企业', '按方向接收岗位更新', '查看已收录联系人']
  },
  {
    id: 'mini_club_quarter_2026', memberType: 'quarter', name: '季度会员', shortLabel: '季度会员',
    price: 199, currency: 'CNY', durationDays: 0, durationMonths: 3, featured: true,
    description: '持续获取匹配企业与公开岗位更新。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    features: ['浏览在招远程企业', '按方向接收岗位更新', '查看已收录联系人']
  },
  {
    id: 'mini_club_half_year_2026', memberType: 'half_year', name: '半年会员', shortLabel: '半年会员',
    price: 699, currency: 'CNY', durationDays: 0, durationMonths: 6, featured: false,
    description: '持续获取企业动态，并完善职业方向与申请材料。会员权益在小程序和网站通用，均可解锁全站数据权限。',
    features: ['浏览在招远程企业并接收方向更新', '查看已收录联系人', '职业方向诊断指导 1 次', '中英文简历优化 1 次', '定制求职材料包 1 次']
  }
]

async function hydrateCompanies(companies: MiniCompany[]) {
  const urls = await resolveCloudFileUrls(companies.map((company) => company.logoFileId))
  return companies.map((company) => ({
    ...company,
    logoUrl: urls.get(company.logoFileId || '') || (isRenderableImageSource(company.logoUrl) ? company.logoUrl : '') || (isRenderableImageSource(company.logoFileId) ? company.logoFileId : '')
  }))
}

async function hydrateNotes(notes: GrowthNote[]) {
  const urls = await resolveCloudFileUrls(notes.map((note) => note.coverFileId))
  return notes.map((note) => ({
    ...note,
    coverUrl: urls.get(note.coverFileId || '') || note.coverUrl || note.coverFileId || ''
  }))
}

export interface MembershipSummary {
  userId?: string | null
  isMember: boolean
  memberType: string
  memberTier?: string
  memberExpireAt?: string | null
}

export interface HomeResponse {
  success: true
  companies: MiniCompany[]
  notes: GrowthNote[]
  membership: MembershipSummary
  consultation: { enabled: boolean; requiresBinding: boolean; topics: string[] }
}

export interface CompaniesResponse {
  success: true
  companies: MiniCompany[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  access: { scope: 'match_required' | 'free_fixed' | 'member_all'; fullDirectory: boolean; previewLimit: number | null; searchEnabled: boolean; searchMode?: 'exact' | 'fuzzy' }
  industries: Array<{ name: string; count: number }>
}

export function fetchMemberServices() {
  return requestJson<{
    success: true
    membership: { isMember: boolean; memberType: string; memberExpireAt?: string | null }
    entitlements: MemberServiceEntitlement[]
  }>('/mini/member-services', { authenticated: true })
}

export function claimMemberService(key: MemberServiceEntitlement['key']) {
  return requestJson<{ success: true; entitlement: MemberServiceEntitlement }>(`/mini/member-services/${encodeURIComponent(key)}/claim`, {
    method: 'POST', authenticated: true
  })
}

export async function fetchHome(_force = false) {
  const response = await requestJson<HomeResponse>('/mini/home', { authenticated: true })
  const [companies, notes] = await Promise.all([hydrateCompanies(response.companies), hydrateNotes(response.notes)])
  return { ...response, companies, notes }
}

export function fetchCompanies(params: { search?: string; industry?: string; page?: number; pageSize?: number; force?: boolean } = {}) {
  const { force: _force = false, ...queryParams } = params
  const query = Object.entries(queryParams)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const path = `/mini/companies${query ? `?${query}` : ''}`
  return requestJson<CompaniesResponse>(path, { authenticated: true }).then(async (response) => {
    const scope = response?.access?.scope
    if (!['match_required', 'free_fixed', 'member_all'].includes(scope)) {
      throw new Error('企业权限数据尚未就绪，请稍后重试')
    }
    const companies = Array.isArray(response.companies) ? response.companies : []
    const directoryCompanies = scope === 'match_required' ? [] : scope === 'free_fixed' ? companies.slice(0, 12) : companies
    const scopedCompanies = scope === 'free_fixed' && params.industry
      ? directoryCompanies.filter((company) => company.industry === params.industry)
      : directoryCompanies
    const industries = Array.isArray(response.industries) && response.industries.length
      ? response.industries
      : [...new Set(directoryCompanies.map((company) => company.industry).filter(Boolean))].map((name) => ({
          name,
          count: directoryCompanies.filter((company) => company.industry === name).length
        }))
    return {
      ...response,
      companies: await hydrateCompanies(scopedCompanies),
      industries,
      access: {
        ...response.access,
        previewLimit: scope === 'free_fixed' ? Math.min(12, directoryCompanies.length) : response.access.previewLimit,
        searchEnabled: true,
        searchMode: scope === 'member_all' ? 'fuzzy' as const : 'exact' as const
      }
    }
  })
}

export async function fetchCompany(id: string, _force = false, accessSearch = '') {
  const searchQuery = accessSearch.trim() ? `?search=${encodeURIComponent(accessSearch.trim())}` : ''
  const response = await requestJson<{
    success: true
    company: MiniCompany
    access: { scope: 'free_fixed' | 'member_all'; fullDirectory: boolean; contacts: boolean }
  }>(`/mini/companies/${encodeURIComponent(id)}${searchQuery}`, { authenticated: true })
  if (!['free_fixed', 'member_all'].includes(response?.access?.scope)) {
    throw new Error('企业访问权限尚未确认，请稍后重试')
  }
  const company = { ...response.company }
  if (!response.access.contacts) delete company.contacts
  return (await hydrateCompanies([company]))[0]
}

export function fetchCompanyJob(companyId: string, jobId: string, accessSearch = '') {
  const searchQuery = accessSearch.trim() ? `?search=${encodeURIComponent(accessSearch.trim())}` : ''
  return requestJson<{
    success: true
    company: { id: string; name: string }
    job: MiniCompanyJobDetail
  }>(`/mini/companies/${encodeURIComponent(companyId)}/jobs/${encodeURIComponent(jobId)}${searchQuery}`, { authenticated: true }).catch(async (error) => {
    // Older CloudRun revisions exposed the formal job detail through the
    // generic jobs route. Keep this as a real-data fallback for an in-flight
    // experience build, never fabricate a job from the card summary.
    if (!jobId) throw error
    const fallback = await requestJson<{ success: true; job: MiniCompanyJobDetail }>(`/mini/jobs/${encodeURIComponent(jobId)}?companyId=${encodeURIComponent(companyId)}`, { authenticated: true })
    if (!fallback?.job) throw error
    return { success: true as const, company: { id: companyId, name: fallback.job.company }, job: fallback.job }
  })
}

export async function fetchFavoriteJobIds() {
  const response = await requestJson<{ success: true; favoriteJobIds: string[] }>('/mini/favorites', { authenticated: true })
  return new Set((Array.isArray(response.favoriteJobIds) ? response.favoriteJobIds : []).map(String))
}

export function setJobFavorite(jobId: string, favorite: boolean) {
  return requestJson<{ success: true; jobId: string; favorite: boolean }>('/mini/favorites', {
    method: 'POST',
    authenticated: true,
    data: { jobId, favorite, idempotencyKey: createRequestKey(`favorite-${jobId}`) }
  })
}

export async function fetchGrowthNotes(_force = false) {
  const response = await requestJson<{ success: true; notes: GrowthNote[]; total: number }>('/mini/growth/notes', { authenticated: true })
  return hydrateNotes(response.notes)
}

export async function fetchGrowthNote(id: string, _force = false) {
  const response = await requestJson<{
    success: true
    note: GrowthNote
    access: { unlocked: boolean; code?: string; message?: string }
  }>(`/mini/growth/notes/${encodeURIComponent(id)}`, { authenticated: true })
  return { ...response, note: (await hydrateNotes([response.note]))[0] }
}

export async function fetchMembershipPlans() {
  const response = await requestJson<{
    success: true
    plans: MiniMembershipPlan[]
    membership: MembershipSummary | null
    paymentAvailable: boolean
  }>('/mini/membership/plans', { authenticated: true })
  const serverPlans = (Array.isArray(response.plans) ? response.plans : []).filter((plan) => {
    const contract = MINI_PLAN_CONTRACTS[plan.id as keyof typeof MINI_PLAN_CONTRACTS]
    return contract && plan.memberType === contract.memberType && Number(plan.price) === contract.price && Number(plan.durationMonths) === contract.durationMonths
  })
  const serverPlanMap = new Map(serverPlans.map((plan) => [plan.id, plan]))
  const plans = MINI_PLAN_FALLBACKS.map((fallback) => ({
    ...fallback,
    ...serverPlanMap.get(fallback.id),
    purchaseAvailable: serverPlanMap.has(fallback.id)
  }))
  return { ...response, plans }
}

export function fetchConsultations() {
  return requestJson<{ success: true; consultations: ConsultationRequest[] }>('/mini/consultations/me', { authenticated: true })
}

export function submitConsultation(data: {
  topic: string
  wechatId: string
  question: string
  sourcePage: string
  sourceContentId?: string
  sourceCompanyId?: string
  idempotencyKey: string
  privacyVersion: string
  acceptedAt: string
}) {
  return requestJson<{
    success: true
    consultation: ConsultationRequest
    advisor: { qrImage: string; message: string }
  }>('/mini/consultations', { method: 'POST', data, authenticated: true })
}
