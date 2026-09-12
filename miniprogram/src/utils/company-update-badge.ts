import type { MiniCompany } from '../types'

const NEW_WINDOW_MS = 72 * 60 * 60 * 1000

export function companyUpdateDeadline(company: Pick<MiniCompany, 'newJobsUntil' | 'publicOpportunityUpdatedAt'>, now: number) {
  const expiry = Date.parse(company.newJobsUntil || '')
  if (Number.isFinite(expiry)) return expiry > now && expiry <= now + NEW_WINDOW_MS ? expiry : 0
  // Older gateways expose the stable first-seen timestamp but omit the expiry.
  const seenAt = Date.parse(company.publicOpportunityUpdatedAt || '')
  return seenAt <= now && seenAt + NEW_WINDOW_MS > now ? seenAt + NEW_WINDOW_MS : 0
}
