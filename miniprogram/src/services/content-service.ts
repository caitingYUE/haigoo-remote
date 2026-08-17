import type { ConsultationRequest, GrowthNote, MiniCompany, MiniMembershipPlan } from '../types'
import { requestJson } from './api-client'
import { resolveCloudFileUrls } from './cloud-asset-service'

const responseCache = new Map<string, { expiresAt: number; value?: unknown; pending?: Promise<unknown> }>()

async function cached<T>(key: string, ttl: number, loader: () => Promise<T>, force = false): Promise<T> {
  const current = responseCache.get(key)
  if (!force && current?.value !== undefined && current.expiresAt > Date.now()) return current.value as T
  if (!force && current?.pending) return current.pending as Promise<T>
  const pending = loader().then((value) => {
    responseCache.set(key, { value, expiresAt: Date.now() + ttl })
    return value
  }).catch((error) => {
    responseCache.delete(key)
    throw error
  })
  responseCache.set(key, { expiresAt: 0, pending })
  return pending
}

async function hydrateCompanies(companies: MiniCompany[]) {
  const urls = await resolveCloudFileUrls(companies.map((company) => company.logoFileId))
  return companies.map((company) => ({ ...company, logoUrl: urls.get(company.logoFileId) || '' }))
}

async function hydrateNotes(notes: GrowthNote[]) {
  const urls = await resolveCloudFileUrls(notes.map((note) => note.coverFileId))
  return notes.map((note) => ({ ...note, coverUrl: urls.get(note.coverFileId || '') || '' }))
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
  access: { fullDirectory: boolean; previewLimit: number | null; searchEnabled: boolean }
  industries: Array<{ name: string; count: number }>
}

export function fetchHome(force = false) {
  return cached('home', 60_000, async () => {
    const response = await requestJson<HomeResponse>('/mini/home', { authenticated: true })
    const [companies, notes] = await Promise.all([hydrateCompanies(response.companies), hydrateNotes(response.notes)])
    return { ...response, companies, notes }
  }, force)
}

export function fetchCompanies(params: { search?: string; industry?: string; page?: number; pageSize?: number; force?: boolean } = {}) {
  const { force = false, ...queryParams } = params
  const query = Object.entries(queryParams)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const path = `/mini/companies${query ? `?${query}` : ''}`
  return cached(path, 60_000, async () => {
    const response = await requestJson<CompaniesResponse>(path, { authenticated: true })
    return { ...response, companies: await hydrateCompanies(response.companies) }
  }, force)
}

export async function fetchCompany(id: string, force = false) {
  return cached(`company:${id}`, 120_000, async () => {
    const response = await requestJson<{ success: true; company: MiniCompany }>(`/mini/companies/${encodeURIComponent(id)}`, { authenticated: true })
    return (await hydrateCompanies([response.company]))[0]
  }, force)
}

export async function fetchGrowthNotes(force = false) {
  return cached('growth-notes', 120_000, async () => {
    const response = await requestJson<{ success: true; notes: GrowthNote[]; total: number }>('/mini/growth/notes', { authenticated: true })
    return hydrateNotes(response.notes)
  }, force)
}

export function fetchGrowthNote(id: string, force = false) {
  return cached(`growth-note:${id}`, 120_000, async () => {
    const response = await requestJson<{
      success: true
      note: GrowthNote
      access: { unlocked: boolean; code?: string; message?: string }
    }>(`/mini/growth/notes/${encodeURIComponent(id)}`, { authenticated: true })
    return { ...response, note: (await hydrateNotes([response.note]))[0] }
  }, force)
}

export function fetchMembershipPlans() {
  return requestJson<{
    success: true
    plans: MiniMembershipPlan[]
    membership: MembershipSummary | null
    paymentAvailable: boolean
  }>('/mini/membership/plans', { authenticated: true })
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
