import type { ConsultationRequest, GrowthNote, MemberServiceEntitlement, MiniCompany, MiniCompanyJobDetail, MiniMembershipPlan } from '../types'
import { requestJson } from './api-client'
import { resolveCloudFileUrls } from './cloud-asset-service'

const MINI_PLAN_CONTRACTS = {
  mini_club_quarter_2026: { memberType: 'quarter', price: 199, durationMonths: 3 },
  mini_club_half_year_2026: { memberType: 'half_year', price: 699, durationMonths: 6 }
} as const

async function hydrateCompanies(companies: MiniCompany[]) {
  const urls = await resolveCloudFileUrls(companies.map((company) => company.logoFileId))
  return companies.map((company) => ({
    ...company,
    logoUrl: urls.get(company.logoFileId || '') || company.logoUrl || company.logoFileId || ''
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
  access: { scope: 'match_required' | 'free_fixed' | 'member_all'; fullDirectory: boolean; previewLimit: number | null; searchEnabled: boolean }
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
    const scopedCompanies = scope === 'match_required' ? [] : scope === 'free_fixed' ? companies.slice(0, 5) : companies
    return { ...response, companies: await hydrateCompanies(scopedCompanies) }
  })
}

export async function fetchCompany(id: string, _force = false) {
  const response = await requestJson<{
    success: true
    company: MiniCompany
    access: { scope: 'free_fixed' | 'member_all'; fullDirectory: boolean; contacts: boolean }
  }>(`/mini/companies/${encodeURIComponent(id)}`, { authenticated: true })
  if (!['free_fixed', 'member_all'].includes(response?.access?.scope)) {
    throw new Error('企业访问权限尚未确认，请稍后重试')
  }
  const company = { ...response.company }
  if (response.access.scope !== 'member_all' || !response.access.contacts) delete company.contacts
  return (await hydrateCompanies([company]))[0]
}

export function fetchCompanyJob(companyId: string, jobId: string) {
  return requestJson<{
    success: true
    company: { id: string; name: string }
    job: MiniCompanyJobDetail
  }>(`/mini/companies/${encodeURIComponent(companyId)}/jobs/${encodeURIComponent(jobId)}`, { authenticated: true })
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
  const plans = Array.isArray(response.plans) ? response.plans : []
  const valid = plans.length === 2 && new Set(plans.map((plan) => plan.id)).size === 2 && plans.every((plan) => {
    const contract = MINI_PLAN_CONTRACTS[plan.id as keyof typeof MINI_PLAN_CONTRACTS]
    return contract && plan.memberType === contract.memberType && Number(plan.price) === contract.price && Number(plan.durationMonths) === contract.durationMonths
  })
  if (!valid) throw new Error('新版会员方案尚未就绪，请稍后重试')
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
