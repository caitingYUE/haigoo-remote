export interface CompanyContactPreview {
  id: string
  maskedName: string
  title: string
}

export function maskCompanyContactName(value: unknown): string
export function buildCompanyContactPreview(contact?: Record<string, unknown>): CompanyContactPreview
export function normalizeOpenRoleCategories(values: unknown, limit?: number): string[]
