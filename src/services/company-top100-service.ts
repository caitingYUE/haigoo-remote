import type { CompanyTop100Response } from '../types/company-top100'

export class CompanyTop100Error extends Error {
  constructor(public status: number, public code: string) { super(code); this.name = 'CompanyTop100Error' }
}

export async function getCompanyTop100(token: string, signal: AbortSignal, companyId?: string): Promise<CompanyTop100Response> {
  const params = new URLSearchParams({ resource: 'trusted-companies', action: 'top100' })
  if (companyId) params.set('companyId', companyId)
  const response = await fetch(`/api/data?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new CompanyTop100Error(response.status, body?.code || 'RANKING_UNAVAILABLE')
  if (!body?.success || !Array.isArray(body.companies) || !body.version || body.total !== 100) throw new CompanyTop100Error(503, 'INVALID_RANKING_RESPONSE')
  return body
}
