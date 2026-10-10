import type { CompanyTop100Response } from '../types/company-top100'

export class CompanyTop100Error extends Error {
  constructor(public status: number, public code: string) { super(code); this.name = 'CompanyTop100Error' }
}

const factors = ['mainland','remote','payment','timezone','basics','business'] as const
function validSource(value: unknown) {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
export function isCompanyTop100Response(body: any, companyId?: string): body is CompanyTop100Response {
  if (body?.success !== true || typeof body.version !== 'string' || typeof body.researchedAt !== 'string' || body.total !== 100 || !Array.isArray(body.companies)
    || body.companies.length !== (companyId ? 1 : 100) || !body.weights || factors.some(key => !Number.isFinite(body.weights[key]) || body.weights[key] < 0)
    || factors.reduce((n,key) => n + body.weights[key], 0) !== 100) return false
  const ids = new Set<string>()
  return body.companies.every((row:any) => {
    if (!row || typeof row.companyId !== 'string' || !row.companyId || ids.has(row.companyId) || (companyId && row.companyId !== companyId)) return false
    ids.add(row.companyId)
    return ['name','industry','geoNote','remoteNote','contractNote','timezoneNote','pending','reviewedAt'].every(key => typeof row[key] === 'string')
      && Number.isInteger(row.rank) && row.rank >= 1 && row.rank <= 100 && Number.isFinite(row.score) && row.score >= 0 && row.score <= 100
      && ['A','B'].includes(row.tier) && ['fully_remote','remote_first','selected_roles','field_work'].includes(row.remoteClass)
      && ['employee_unconfirmed','contractor','project','unknown'].includes(row.contractClass)
      && ['available','unavailable','unknown'].includes(row.availability)
      && (row.jobCount === null || (Number.isInteger(row.jobCount) && row.jobCount >= 0))
      && ['roles','notes','sources'].every(key => Array.isArray(row[key]) && row[key].every((value:unknown) => typeof value === 'string'))
      && row.sources.length > 0 && row.sources.every(validSource) && !!row.components && factors.every(key => row.components[key] === null || Number.isFinite(row.components[key]))
      && (row.basics?.employeeCount === null || typeof row.basics?.employeeCount === 'string') && (row.basics?.ratingSource === null || typeof row.basics?.ratingSource === 'string') && (row.basics?.foundedYear === null || Number.isInteger(row.basics?.foundedYear))
      && (row.applicationNote === undefined || typeof row.applicationNote === 'string') && !!row.unknown && !!row.basics && (row.basics.rating === null || Number.isFinite(row.basics.rating))
  })
}

export async function getCompanyTop100(token: string, signal: AbortSignal, companyId?: string): Promise<CompanyTop100Response> {
  const params = new URLSearchParams({ resource: 'trusted-companies', action: 'top100' })
  if (companyId) params.set('companyId', companyId)
  const response = await fetch(`/api/data?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new CompanyTop100Error(response.status, body?.code || 'RANKING_UNAVAILABLE')
  if (!isCompanyTop100Response(body, companyId)) throw new CompanyTop100Error(503, 'INVALID_RANKING_RESPONSE')
  return body
}
