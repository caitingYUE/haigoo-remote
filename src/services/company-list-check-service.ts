export interface ListFinding { key: string; kind: 'new' | 'missing'; title: string; url: string; location?: string; jobId?: string; reason: string; detectedAt: string }
export interface ListCheckState {
  company_id: string; source_url: string; status: 'unchecked' | 'checked' | 'unknown' | 'skipped'; failures: number
  findings: ListFinding[]; reasons: string[]; checked_at?: string; checking?: boolean
  candidates?: { title: string; url: string; location?: string; reason: string }[]; candidate_count?: number
  pages?: number; listed_count?: number
}
export interface ListCheckRun { id: string; companyIds: string[]; attempts: { company_id: string; company_name: string; status: string; result?: Partial<ListCheckState> }[] }
export interface ListCheckResponse { success: boolean; states?: Record<string, ListCheckState>; run?: ListCheckRun; busy?: boolean }
export async function listCheckRequest(body?: Record<string, unknown>, query: Record<string, string> = {}): Promise<ListCheckResponse> {
  const response = await fetch(`/api/admin/job-sync?${new URLSearchParams({workflow:'listing',...query})}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token') || ''}`, ...(body ? {'Content-Type':'application/json'} : {}) },
    ...(body ? {body:JSON.stringify(body)} : {})
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error || '检查结果暂时无法读取，请重试')
  return data
}
export const listCheckLabel = (state?: ListCheckState) => state?.status === 'skipped' ? '跳过检查' : state?.status === 'unknown' ? '无法判断' : state?.status === 'checked' ? '未发现变化' : '尚未检查'
