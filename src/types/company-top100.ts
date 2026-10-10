export type Top100Factor = 'mainland' | 'remote' | 'payment' | 'timezone' | 'basics' | 'business'
export interface CompanyTop100Entry {
  companyId: string; name: string; rank: number; score: number; tier: 'A' | 'B'; industry: string
  applicationNote?: string
  geoNote: string; remoteClass: 'fully_remote' | 'remote_first' | 'selected_roles' | 'field_work'; remoteNote: string
  contractClass: 'employee_unconfirmed' | 'contractor' | 'project' | 'unknown'; contractNote: string; timezoneNote: string
  opportunityScore: number; roles: string[]; notes: string[]; pending: string; sources: string[]; reviewedAt: string
  components: Record<Top100Factor, number | null>; unknown: Partial<Record<Top100Factor, boolean>>
  basics: { rating: number | null; ratingSource: string | null; foundedYear: number | null; employeeCount: string | null; source: string | null }
  availability: 'available' | 'unavailable' | 'unknown'; website: string | null; careersPage: string | null
  logo: string | null; cachedLogoUrl: string | null; jobCount: number | null; liveUpdatedAt: string | null
}
export interface CompanyTop100Response {
  success: true; version: string; researchedAt: string; weights: Record<Top100Factor, number>; total: number; companies: CompanyTop100Entry[]
}
