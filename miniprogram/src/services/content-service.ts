import type { CompanyAccess, ConsultationRequest, GrowthNote, MemberServiceEntitlement, MiniCompany, MiniCompanyJob, MiniCompanyJobDetail, MiniMembershipPlan } from '../types'
import { createRequestKey, requestJson } from './api-client'
import { isRenderableImageSource, resolveCloudFileUrls } from './cloud-asset-service'

const MINI_PLAN_CONTRACTS = {
  club_starter_monthly: { memberType: 'starter', price: 99, durationMonths: 1 },
  mini_club_quarter_2026: { memberType: 'quarter', price: 199, durationMonths: 3 },
  mini_club_half_year_2026: { memberType: 'half_year', price: 699, durationMonths: 6 }
} as const

async function hydrateCompanies<T extends { logoFileId?: string; logoUrl?: string }>(companies: T[]) {
  const urls = await resolveCloudFileUrls(companies.flatMap((company) => (
    /^https?:\/\//i.test(String(company.logoUrl || '')) ? [] : [company.logoFileId, company.logoUrl]
  )))
  return companies.map((company) => ({
    ...company,
    logoUrl: (/^https?:\/\//i.test(String(company.logoUrl || '')) ? company.logoUrl : '') || urls.get(company.logoFileId || '') || urls.get(company.logoUrl || '') || (isRenderableImageSource(company.logoFileId) ? company.logoFileId : '')
  }))
}

async function hydrateNotes(notes: GrowthNote[]) {
  const urls = await resolveCloudFileUrls(notes.flatMap((note) => (
    /^https?:\/\//i.test(String(note.coverUrl || '')) ? [] : [note.coverFileId]
  )))
  return notes.map((note) => ({
    ...note,
    coverUrl: (/^https?:\/\//i.test(String(note.coverUrl || '')) ? note.coverUrl : '') || urls.get(note.coverFileId || '') || note.coverFileId || ''
  }))
}

export interface MembershipSummary {
  userId?: string | null
  isMember: boolean
  memberType: string
  memberTier?: string
  memberExpireAt?: string | null
}

export type CompanyDirectorySort = 'latest' | 'newest' | 'relevance'

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
  sortBy: CompanyDirectorySort
  serverTime?: string
  searchOutcome?: 'matched' | 'too_broad' | 'not_found' | null
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

export function fetchCompanies(params: { search?: string; industry?: string; sortBy?: CompanyDirectorySort; page?: number; pageSize?: number; force?: boolean } = {}) {
  const { force: _force = false, ...queryParams } = params
  const sortBy: CompanyDirectorySort = queryParams.sortBy === 'relevance'
    ? 'relevance'
    : queryParams.sortBy === 'newest' ? 'newest' : 'latest'
  queryParams.sortBy = sortBy
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
    // The gateway owns directory eligibility. Older deployed revisions omit
    // these fields, so only reject companies that are explicitly closed.
    const companies = (Array.isArray(response.companies) ? response.companies : [])
      .filter((company) => {
        const availability = String(company.hasPublicOpportunity).trim().toLowerCase()
        const countText = String(company.openJobCount ?? '').trim()
        const count = Number(countText)
        return !['false', '0'].includes(availability)
          && (!countText || !Number.isFinite(count) || count > 0)
      })
    const directoryCompanies = scope === 'match_required' ? [] : scope === 'free_fixed' ? companies.slice(0, 12) : companies
    const scopedCompanies = scope === 'free_fixed' && params.industry && !params.search?.trim()
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
      sortBy: response.sortBy === 'relevance'
        ? 'relevance'
        : response.sortBy === 'newest' ? 'newest' : sortBy,
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

export async function fetchCompanyDetail(id: string, _force = false, accessSearch = '') {
  const searchQuery = accessSearch.trim() ? `?search=${encodeURIComponent(accessSearch.trim())}` : ''
  const response = await requestJson<{
    success: true
    company: MiniCompany
    access: CompanyAccess
  }>(`/mini/companies/${encodeURIComponent(id)}${searchQuery}`, { authenticated: true })
  if (!['free_fixed', 'member_all'].includes(response?.access?.scope)) {
    throw new Error('企业访问权限尚未确认，请稍后重试')
  }
  const [company] = await hydrateCompanies([response.company])
  return {
    company,
    access: {
      ...response.access,
      contactPreview: Boolean(response.access.contactPreview)
    }
  }
}

export async function fetchCompany(id: string, force = false, accessSearch = '') {
  return (await fetchCompanyDetail(id, force, accessSearch)).company
}

export interface CompanyJobIdentity {
  id: string
  name: string
  logoFileId?: string
  logoUrl?: string
}

export async function fetchCompanyJob(companyId: string, jobId: string, accessSearch = '') {
  const searchQuery = accessSearch.trim() ? `?search=${encodeURIComponent(accessSearch.trim())}` : ''
  const response = await requestJson<{
    success: true
    company: CompanyJobIdentity
    job: MiniCompanyJobDetail
  }>(`/mini/companies/${encodeURIComponent(companyId)}/jobs/${encodeURIComponent(jobId)}${searchQuery}`, { authenticated: true })
  const [company] = await hydrateCompanies<CompanyJobIdentity>([response.company])
  return { ...response, company }
}

export async function fetchFavoriteJobIds() {
  const response = await requestJson<{ success: true; favoriteJobIds: string[] }>('/mini/favorites?idsOnly=true', { authenticated: true })
  return new Set((Array.isArray(response.favoriteJobIds) ? response.favoriteJobIds : []).map(String))
}

export interface FavoriteJobRecord {
  jobId: string
  createdAt: string | null
  title: string
  company: string
  job: MiniCompanyJob | null
}

export async function fetchFavoriteJobs(page = 1) {
  const response = await requestJson<{ success: true; favorites: FavoriteJobRecord[]; page: number; hasMore: boolean }>(`/mini/favorites?page=${page}`, { authenticated: true })
  // An older/incomplete response is a loading failure, not proof a job is gone.
  if (!Array.isArray(response?.favorites) || !Number.isInteger(response.page) || response.page < 1
    || typeof response.hasMore !== 'boolean'
    || response.favorites.some((record) => !record?.jobId || !Object.prototype.hasOwnProperty.call(record, 'job'))) {
    throw new Error('收藏记录暂时无法加载，请稍后重试')
  }
  return response
}

export function setJobFavorite(jobId: string, favorite: boolean, companyId = '') {
  return requestJson<{ success: true; jobId: string; favorite: boolean }>('/mini/favorites', {
    method: 'POST',
    authenticated: true,
    data: { jobId, favorite, companyId, idempotencyKey: createRequestKey(`favorite-${jobId}`) }
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
  const plans = serverPlans.map((plan) => ({
    ...plan,
    purchaseAvailable: Boolean(response.paymentAvailable) && plan.purchaseAvailable !== false
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
