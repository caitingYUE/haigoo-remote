/** Authenticated manual workflow. Reading state never starts collection. */
export type CrawlMode = 'preflight' | 'update'
export type CrawlFields = Record<string, unknown>
export interface CrawlQualification { status: 'unreviewed' | 'approved' | 'rejected'; url?: string; reason?: string }
export interface CrawlItem {
  id: string; sessionId?: string; companyId: string; companyName: string
  kind: 'create' | 'update' | 'close' | 'unchanged' | 'unknown' | 'restore'
  status: string; raw: CrawlFields; draft: CrawlFields; before?: CrawlFields
  reason?: string; jobId?: string; version: number
}
export interface CrawlCompanyTask {
  companyId: string; name: string; url: string; status: string; attempt: number; retries: number
  stage: string; error?: string; reason?: string; partial?: string; raw?: CrawlFields; items: CrawlItem[]
  progress?: { checked: number; total?: number; pages: number }; canApprove?: boolean
}
export interface CrawlSession {
  id: string; mode: CrawlMode; status: 'running' | 'awaiting_review' | 'paused' | 'complete' | 'cancelled'
  companyIds: string[]; companies: CrawlCompanyTask[]; items: CrawlItem[]
  currentCompanyId?: string; summary?: Record<string, number>
  itemsTotal?: number; itemsOffset?: number; itemsCompanyId?: string
  publicationErrors?: { companyId: string; error: string; status: 'pending' | 'failed' }[]
}
export interface CrawlResponse {
  success: boolean; session?: CrawlSession; qualifications?: Record<string, CrawlQualification>
  sessions?: CrawlSession[]; reviewItems?: CrawlItem[]; error?: string; warning?: string; publicationError?: string
  reviewTotal?: number; item?: CrawlItem; evidence?: CrawlFields
}
export async function manualCrawlRequest(body?: Record<string, unknown>, query: Record<string, string> = {}): Promise<CrawlResponse> {
  const params = new URLSearchParams({ workflow: 'manual', ...query })
  const response = await fetch(`/api/admin/job-sync?${params}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token') || ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.error || '读取操作结果失败，请重新读取。不会自动重试抓取。')
  return result
}
